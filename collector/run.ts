/* The collector: one run a day, around 09:30 Israel time, from GitHub Actions (.github/workflows/collect.yml;
   the schedule is in shared/schedule.ts).

   1. Read the app's config (feed-path.json) and the collector's own files from the gist.
   2. Read every enabled source's feed; keep items it hasn't seen from the last 48 hours, plus the ones
      saved by the reading-only passes during the day.
   3. Add the links I asked for.
   4. Triage with Claude: score per topic, and spot items that are the same story.
   5. Items of a story already in the feed become extra sources of that entry; new stories that
      reach a topic's threshold get a summary; the rest go to the "filtered" list.
   6. Write feed.json and collector.json back (never the app's file).

   node collector/run.ts           gist + Claude (needs GIST_TOKEN and ANTHROPIC_API_KEY)
   node collector/run.ts --morning the same, but only if it's the morning slot (scheduled triggers; see shared/schedule.ts);
                                   otherwise a reading-only pass
   node collector/run.ts --read-only  read the sources and save new items to collector.json for the morning; no Claude.
                                   Busy feeds keep only their latest items (Ynet ~16 h), so this runs every 3 hours.
   node collector/run.ts --local   files in collector/out/ + Claude (needs ANTHROPIC_API_KEY)
   node collector/run.ts --dry     files in collector/out/, no Claude: stub scores and summaries */
import { appendFile, mkdir, readFile, writeFile } from "node:fs/promises";
import { isMorningSlot, localParts } from "../shared/schedule.ts";
import { DEFAULT_SETTINGS, seedAppFile } from "../shared/seed.ts";
import type { AppFile, CollectorState, Entry, EntrySource, FeedFile, PendingItem, RunInfo, Topic } from "../shared/types.ts";
import { MODEL, Refused, costUsd, summarize, triage, usage, type Summary, type SummaryDoc, type TriageResult, type TriageStory } from "./claude.ts";
import { extract, type Extracted } from "./extract.ts";
import { APP_FILE, FEED_FILE, STATE_FILE, findOrCreateGist, readGist, writeGist } from "./gist.ts";
import { canonicalUrl, hash, isHttpUrl, pool } from "./net.ts";
import { readFeed, resolveFeed, sourceInput, type RawItem } from "./sources.ts";

const args = new Set(process.argv.slice(2));
const DRY = args.has("--dry");
const LOCAL = DRY || args.has("--local");
const MORNING = args.has("--morning");
const READ_ONLY = args.has("--read-only");
const OUT = new URL("./out/", import.meta.url);

const HOUR = 3_600_000;
const DAY = 24 * HOUR;
/** items published before this are ignored (a run a day, with room for late feeds and a missed run) */
const WINDOW = 48 * HOUR;
/** a source's first run only looks back this far, and takes fewer items, so adding one doesn't flood the feed */
const FIRST_WINDOW = 24 * HOUR;
const PER_SOURCE = DRY ? 4 : 40;
const PER_SOURCE_FIRST = DRY ? 4 : 15;
const TRIAGE_BATCH = 50;
const RECENT_STORIES = 200;
const DOCS_PER_STORY = 3;

const now = Date.now();
const msg = (e: unknown) => (e instanceof Error ? e.message : String(e));
const arr = <T,>(v: unknown): T[] => (Array.isArray(v) ? (v as T[]) : []);
const obj = <T extends object>(v: unknown): T => (v && typeof v === "object" && !Array.isArray(v) ? (v as T) : ({} as T));

// ── files ─────────────────────────────────────────────────────

function parse(text: string | undefined): unknown {
  if (!text) return undefined;
  try { return JSON.parse(text); } catch { return undefined; }
}

function normalizeApp(raw: unknown): AppFile {
  const seed = seedAppFile();
  if (!raw || typeof raw !== "object") return seed;
  const x = raw as Partial<AppFile>;
  return {
    ...seed,
    sources: Array.isArray(x.sources) ? x.sources : seed.sources,
    topics: Array.isArray(x.topics) ? x.topics : seed.topics,
    links: arr(x.links),
    settings: { ...DEFAULT_SETTINGS, ...obj(x.settings) },
  };
}

function normalizeFeed(raw: unknown): FeedFile {
  const x = obj<Partial<FeedFile>>(raw);
  return {
    v: 1,
    updatedAt: x.updatedAt ?? 0,
    entries: arr(x.entries),
    filtered: arr(x.filtered),
    health: obj(x.health),
    links: obj(x.links),
    runs: arr(x.runs),
    lastRead: x.lastRead,
    waiting: x.waiting,
  };
}

function normalizeState(raw: unknown): CollectorState {
  const x = obj<Partial<CollectorState>>(raw);
  return { v: 1, seen: obj(x.seen), resolved: obj(x.resolved), pending: arr(x.pending) };
}

interface Loaded { app: AppFile; feed: FeedFile; state: CollectorState; save: (feed: FeedFile, state: CollectorState) => Promise<void> }

async function load(): Promise<Loaded> {
  if (LOCAL) {
    await mkdir(OUT, { recursive: true });
    const read = async (name: string) => { try { return await readFile(new URL(name, OUT), "utf8"); } catch { return undefined; } };
    let appText = await read(APP_FILE);
    if (!appText) { appText = JSON.stringify(seedAppFile(), null, 1); await writeFile(new URL(APP_FILE, OUT), appText); }
    return {
      app: normalizeApp(parse(appText)),
      feed: normalizeFeed(parse(await read(FEED_FILE))),
      state: normalizeState(parse(await read(STATE_FILE))),
      save: async (feed, state) => {
        await writeFile(new URL(FEED_FILE, OUT), JSON.stringify(feed, null, 1));
        await writeFile(new URL(STATE_FILE, OUT), JSON.stringify(state));
      },
    };
  }
  const token = process.env.GIST_TOKEN;
  if (!token) throw new Error("GIST_TOKEN is not set (a classic GitHub token with the gist scope)");
  const empty = (): FeedFile => normalizeFeed({});
  const id = process.env.GIST_ID || await findOrCreateGist(token, {
    [APP_FILE]: JSON.stringify(seedAppFile()),
    [FEED_FILE]: JSON.stringify(empty()),
    [STATE_FILE]: JSON.stringify(normalizeState({})),
  });
  const files = await readGist(token, id);
  return {
    app: normalizeApp(parse(files[APP_FILE])),
    feed: normalizeFeed(parse(files[FEED_FILE])),
    state: normalizeState(parse(files[STATE_FILE])),
    save: (feed, state) => writeGist(token, id, { [FEED_FILE]: JSON.stringify(feed), [STATE_FILE]: JSON.stringify(state) }),
  };
}

/** What a pending item keeps: no full text (the morning run fetches the page), a short excerpt except for videos,
    whose description is what gets summarized. */
function slim(it: RawItem): PendingItem {
  const { key, sourceId, sourceName, kind, url, title, snippet, publishedAt, image, hints } = it;
  return { key, sourceId, sourceName, kind, url, title, snippet: kind === "video" ? snippet : snippet.slice(0, 800), publishedAt, image, hints };
}

// ── stubs for --dry ───────────────────────────────────────────

function dryTriage(cands: RawItem[]): Map<string, TriageResult> {
  return new Map(cands.map((c, i) => [`C${i + 1}`, { sameAs: null, scores: new Map(c.hints.map((h) => [h, 75])) }]));
}
function drySummary(docs: SummaryDoc[]): Summary {
  const d = docs[0];
  const first = (d.text.split(/(?<=[.!?])\s/)[0] || d.title).slice(0, 220);
  return { title: d.title, tldr: first, bullets: [], why: "", lang: /[֐-׿]/.test(d.title) ? "he" : "en" };
}

// ── run ───────────────────────────────────────────────────────

interface Group {
  items: RawItem[];
  scores: Map<string, number>;
  /** set when the items belong to an entry already in the feed */
  entry?: Entry;
  title: string;
}

async function main() {
  const errors: string[] = [];
  const { app, feed, state, save } = await load();
  let readOnly = READ_ONLY;
  if (MORNING) {
    const last = feed.runs.find((r) => r.scheduled)?.at;
    if (!isMorningSlot(now, last)) {
      const here = localParts(now);
      console.log(`Not the morning slot (${here.date} ${here.hour}:xx in Israel${last ? `, last scheduled run ${localParts(last).date}` : ""}): reading only.`);
      readOnly = true;
    }
  }
  const waiting = new Map(state.pending.filter((p) => !state.seen[p.key] && p.publishedAt >= now - WINDOW).map((p) => [p.key, p]));
  const topics = app.topics.filter((t) => t.enabled && !t.deletedAt);
  const topicById = new Map(topics.map((t) => [t.id, t]));
  const sources = app.sources.filter((s) => s.enabled && !s.deletedAt);
  console.log(`${readOnly ? "Reading only" : LOCAL ? (DRY ? "Dry run" : "Local run") : "Run"} · ${sources.length} sources · ${topics.length} topics · ${waiting.size} saved items · model ${readOnly || DRY ? "none" : MODEL}`);

  // 1. sources
  const fresh: RawItem[] = [];
  await pool(sources, 6, async (s) => {
    const prev = feed.health[s.id];
    try {
      const feedUrl = await resolveFeed(s, state.resolved[s.id]);
      if (s.kind !== "search") state.resolved[s.id] = { input: sourceInput(s), feedUrl };
      const items = await readFeed(s, feedUrl);
      const since = now - (prev ? WINDOW : FIRST_WINDOW);
      const news = items.filter((i) => !state.seen[i.key] && !waiting.has(i.key) && i.publishedAt >= since).slice(0, prev ? PER_SOURCE : PER_SOURCE_FIRST);
      fresh.push(...news);
      feed.health[s.id] = { lastRun: now, ok: true, items: items.length, newItems: news.length, feedUrl };
      console.log(`  ${s.name}: ${items.length} in feed, ${news.length} new`);
    } catch (e) {
      feed.health[s.id] = { ...prev, lastRun: now, ok: false, items: prev?.items ?? 0, newItems: 0, error: msg(e) };
      errors.push(`${s.name}: ${msg(e)}`);
      console.log(`  ${s.name}: ERROR ${msg(e)}`);
    }
  });
  const live = new Set(app.sources.filter((s) => !s.deletedAt).map((s) => s.id));
  for (const id of Object.keys(feed.health)) if (!live.has(id)) delete feed.health[id];

  // The same article can come from two feeds (e.g. NYT U.S. and NYT World): keep one, with both hints.
  const byKey = new Map<string, RawItem>(waiting);
  for (const it of fresh) {
    const had = byKey.get(it.key);
    if (had) had.hints = [...new Set([...had.hints, ...it.hints])];
    else byKey.set(it.key, it);
  }

  // Reading only: save the new items for the morning run and stop.
  if (readOnly) {
    const before = waiting.size;
    state.pending = [...byKey.values()].map(slim);
    feed.lastRead = now;
    feed.waiting = state.pending.length;
    await save(feed, state);
    const line = `Read ${sources.length} sources · ${state.pending.length - before} new items saved · ${state.pending.length} waiting for the morning · ${errors.length} errors · ${Math.round((Date.now() - now) / 1000)} s`;
    console.log(line);
    if (process.env.GITHUB_STEP_SUMMARY) {
      const errs = errors.length ? `\n\n**Errors**\n\n${errors.map((e) => `- ${e}`).join("\n")}` : "";
      await appendFile(process.env.GITHUB_STEP_SUMMARY, `### Feed Path reading pass\n\n${line}${errs}\n`);
    }
    return;
  }

  // 2. links I asked for
  const pages = new Map<string, Extracted>(); // item key → extracted page, reused by the summary step
  const pending = app.links.filter((l) => !l.deletedAt && !feed.links[l.id]);
  await pool(pending, 4, async (l) => {
    if (!isHttpUrl(l.url)) { feed.links[l.id] = { at: now, error: "Not a web link" }; return; }
    try {
      const ex = await extract(l.url);
      const key = hash(canonicalUrl(l.url));
      pages.set(key, ex);
      byKey.set(key, {
        key, sourceId: "link", sourceName: ex.siteName || new URL(ex.url).hostname.replace(/^www\./, ""),
        kind: ex.basis === "description" ? "video" : "article",
        url: ex.url, title: ex.title || ex.url, snippet: ex.text.slice(0, 600),
        publishedAt: now, image: ex.image, hints: [], requested: l.id,
      });
    } catch (e) {
      feed.links[l.id] = { at: now, error: msg(e) };
      errors.push(`Link ${l.url}: ${msg(e)}`);
    }
  });

  const candidates = [...byKey.values()];
  console.log(`${candidates.length} new items`);

  // 3. triage
  const recentEntries = feed.entries.filter((e) => e.publishedAt >= now - WINDOW).slice(0, RECENT_STORIES);
  const groups: Group[] = recentEntries.map((e) => ({ items: [], scores: new Map(), entry: e, title: e.title }));
  const triaged = new Set<string>();
  for (let b = 0; b < candidates.length; b += TRIAGE_BATCH) {
    const batch = candidates.slice(b, b + TRIAGE_BATCH);
    const stories: TriageStory[] = groups.map((g, i) => ({ ref: `S${i + 1}`, title: g.title }));
    let result: Map<string, TriageResult>;
    try {
      result = DRY ? dryTriage(batch) : await triage(topics, stories, batch.map((c, i) => ({ ref: `C${i + 1}`, source: c.sourceName, title: c.title, snippet: c.snippet, hints: c.hints })));
    } catch (e) {
      errors.push(`Triage: ${msg(e)}`);
      console.log(`  triage ERROR ${msg(e)}`);
      // A decline would repeat on every run, so those items are set aside; any other error (network,
      // overload) leaves them unseen to be tried again next run.
      if (e instanceof Refused) {
        for (const it of batch) {
          state.seen[it.key] = now;
          if (it.requested) feed.links[it.requested] = { at: now, error: "Claude declined to process this link" };
        }
      }
      continue;
    }
    const groupOfCand = new Map<string, Group>();
    batch.forEach((item, i) => {
      const ref = `C${i + 1}`;
      const r = result.get(ref);
      if (!r) return; // left out of the reply: tried again next run
      let g: Group | undefined;
      if (r.sameAs?.startsWith("S")) g = groups[Number(r.sameAs.slice(1)) - 1];
      else if (r.sameAs) g = groupOfCand.get(r.sameAs);
      if (!g) { g = { items: [], scores: new Map(), title: item.title }; groups.push(g); }
      g.items.push(item);
      for (const [t, s] of r.scores) g.scores.set(t, Math.max(g.scores.get(t) ?? 0, s));
      groupOfCand.set(ref, g);
      triaged.add(item.key);
    });
  }

  // 4. merge, filter, summarize
  const seen = (it: RawItem) => { state.seen[it.key] = now; };
  const bestTopic = (scores: Map<string, number>) => {
    let best: Topic | undefined, top = -1;
    for (const [id, s] of scores) { const t = topicById.get(id); if (t && s > top) { best = t; top = s; } }
    return { topic: best, score: Math.max(0, top) };
  };
  const passes = (g: Group) => g.items.some((i) => i.requested) || [...g.scores].some(([id, s]) => { const t = topicById.get(id); return !!t && s >= t.minScore; });
  const basisOf = (it: RawItem): EntrySource["basis"] => (it.fullText ? "full" : it.kind === "headline" ? "headline" : it.kind === "video" ? "description" : "excerpt");
  const toSource = (it: RawItem, basis = basisOf(it)): EntrySource =>
    ({ url: it.url, title: it.title, sourceId: it.sourceId, sourceName: it.sourceName, kind: it.kind, publishedAt: it.publishedAt, basis });
  const scoreList = (m: Map<string, number>) => [...m].map(([topic, score]) => ({ topic, score })).sort((a, b) => b.score - a.score);

  let merged = 0, dropped = 0;
  const added: Entry[] = [];
  const toSummarize: Group[] = [];
  for (const g of groups) {
    if (!g.items.length) continue;
    if (g.entry) {
      const e = g.entry;
      for (const it of g.items) {
        if (!e.sources.some((s) => canonicalUrl(s.url) === canonicalUrl(it.url))) { e.sources.push(toSource(it)); merged++; }
        if (it.requested) feed.links[it.requested] = { at: now, entryId: e.id };
        seen(it);
      }
      const all = new Map(e.topics.map((t) => [t.topic, t.score]));
      for (const [t, s] of g.scores) all.set(t, Math.max(all.get(t) ?? 0, s));
      e.topics = scoreList(all);
      e.score = e.topics[0]?.score ?? 0;
      e.updatedAt = now;
    } else if (passes(g)) {
      toSummarize.push(g);
    } else {
      const { topic, score } = bestTopic(g.scores);
      for (const it of g.items) {
        feed.filtered.push({ title: it.title, url: it.url, sourceName: it.sourceName, score, topic: topic?.id, at: now });
        seen(it);
        dropped++;
      }
    }
  }
  console.log(`${toSummarize.length} new stories to summarize, ${merged} merged into existing ones, ${dropped} filtered out`);

  await pool(toSummarize, 4, async (g) => {
    // Main source first: a link I asked for, then articles / videos before bare headlines, then the earliest.
    const rank = (i: RawItem) => (i.requested ? 0 : i.kind === "headline" ? 2 : 1);
    const items = [...g.items].sort((a, b) => rank(a) - rank(b) || a.publishedAt - b.publishedAt);
    const basis = new Map<string, EntrySource["basis"]>();
    const docs: SummaryDoc[] = [];
    let image = items.find((i) => i.image)?.image;
    const used = new Set<string>();
    for (const it of items) {
      if (docs.length >= DOCS_PER_STORY) break;
      if (used.has(it.sourceName)) continue;
      used.add(it.sourceName);
      let text = it.fullText ?? it.snippet;
      let b = basisOf(it);
      if (it.kind === "article" && !it.fullText) {
        try {
          const ex = pages.get(it.key) ?? await extract(it.url);
          if (ex.basis === "full" || ex.text.length > text.length) { text = ex.text; b = ex.basis === "full" ? "full" : "excerpt"; }
          image ??= ex.image;
        } catch { /* the feed's excerpt will do */ }
      }
      if (!text) b = "headline";
      basis.set(it.key, b);
      docs.push({ source: it.sourceName, title: it.title, text, basis: b });
    }
    const { topic } = bestTopic(g.scores);
    const requested = items.find((i) => i.requested);
    try {
      const s = DRY ? drySummary(docs) : await summarize(topic, docs);
      const topicsScored = scoreList(g.scores);
      const entry: Entry = {
        id: `e_${hash(items[0].key, 12)}`,
        title: s.title || items[0].title,
        tldr: s.tldr,
        bullets: s.bullets,
        why: s.why || undefined,
        lang: s.lang || "en",
        topics: topicsScored,
        score: topicsScored[0]?.score ?? 0,
        sources: items.map((it) => toSource(it, basis.get(it.key))),
        image,
        // a link I asked for counts from when I asked, so an old article isn't buried
        publishedAt: requested ? now : Math.min(...items.map((i) => i.publishedAt)),
        createdAt: now,
        updatedAt: now,
        requested: requested ? true : undefined,
      };
      added.push(entry);
      for (const it of items) {
        seen(it);
        if (it.requested) feed.links[it.requested] = { at: now, entryId: entry.id };
      }
    } catch (e) {
      if (e instanceof Refused) {
        for (const it of items) { seen(it); if (it.requested) feed.links[it.requested] = { at: now, error: e.message }; }
      }
      errors.push(`Summary of "${items[0].title}": ${msg(e)}`); // other errors: unseen, tried again next run
    }
  });

  // 5. prune and save
  const keep = now - Math.max(1, app.settings.keepDays) * DAY;
  feed.entries = [...added, ...feed.entries.filter((e) => e.createdAt >= keep)].sort((a, b) => b.publishedAt - a.publishedAt);
  feed.filtered = feed.filtered.filter((f) => f.at >= now - 2 * DAY).sort((a, b) => b.at - a.at).slice(0, 400);
  for (const [id, l] of Object.entries(feed.links)) if (l.at < now - 30 * DAY) delete feed.links[id];
  for (const [k, t] of Object.entries(state.seen)) if (t < now - 7 * DAY) delete state.seen[k];
  // Items Claude didn't get to (a failed call, left out of a reply) wait for the next morning.
  state.pending = candidates.filter((c) => !c.requested && !state.seen[c.key] && c.publishedAt >= now - WINDOW).map(slim);
  feed.lastRead = now;
  feed.waiting = state.pending.length;

  const run: RunInfo = {
    at: now, ms: Date.now() - now, candidates: candidates.length, added: added.length, merged, dropped,
    errors: errors.slice(0, 30), tokens: DRY ? undefined : { ...usage }, dry: DRY || undefined, scheduled: MORNING || undefined,
  };
  feed.runs = [run, ...feed.runs].slice(0, 20);
  feed.updatedAt = now;
  await save(feed, state);

  const kb = Math.round(JSON.stringify(feed).length / 1024);
  const cost = DRY ? "" : ` · ${usage.in.toLocaleString()} tokens in, ${usage.out.toLocaleString()} out ≈ $${costUsd(usage).toFixed(3)}`;
  const line = `Added ${added.length} · merged ${merged} · filtered ${dropped} · ${errors.length} errors · ${feed.entries.length} entries (${kb} KB)${cost} · ${Math.round(run.ms / 1000)} s`;
  console.log(line);
  if (process.env.GITHUB_STEP_SUMMARY) {
    const errs = errors.length ? `\n\n**Errors**\n\n${errors.map((e) => `- ${e}`).join("\n")}` : "";
    await appendFile(process.env.GITHUB_STEP_SUMMARY, `### Feed Path run\n\n${line}${errs}\n`);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
