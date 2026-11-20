/* The feed: topic chips, search, Latest (by day) or Top (by score), links waiting for the next run,
   and #feed/filtered: the headlines that scored too low, for tuning thresholds. */
import { useMemo, useState, type FormEvent } from "react";
import type { Entry, Topic } from "../../shared/types";
import { EntryCard, scoreClass } from "../components/EntryCard";
import { IconBack, IconClose, IconExternal, IconLink, IconSearch } from "../components/Icons";
import { nextRun } from "../../shared/schedule";
import { Seg, Sheet, useSessionState } from "../components/ui";
import { addLink, liveTopics, markAllRead, removeLink } from "../state/actions";
import { useFeed } from "../state/feed";
import { useAppState } from "../state/store";
import { useSyncStatus } from "../state/sync";
import { host, safeUrl } from "../lib/text";
import { ago, clock, dayKey, dayLabel } from "../lib/time";

type Sort = "latest" | "top";

/** "today around 09:30" / "tomorrow around 09:30" */
function nextLabel(t: number) {
  const day = dayKey(t) === dayKey(Date.now()) ? "today" : "tomorrow";
  return `${day} around ${clock(t)}`;
}

function matches(e: Entry, q: string) {
  if (!q) return true;
  const hay = `${e.title} ${e.tldr} ${e.bullets.join(" ")} ${e.sources.map((s) => `${s.sourceName} ${s.title}`).join(" ")}`.toLowerCase();
  return q.toLowerCase().split(/\s+/).filter(Boolean).every((w) => hay.includes(w));
}

export function Feed({ sub, onOpenSync }: { sub?: string; onOpenSync: () => void }) {
  if (sub === "filtered") return <Filtered />;
  return <FeedList onOpenSync={onOpenSync} />;
}

function FeedList({ onOpenSync }: { onOpenSync: () => void }) {
  const feed = useFeed();
  const app = useAppState();
  const sync = useSyncStatus();
  const topics = liveTopics(app.topics);
  const topicMap = useMemo(() => new Map(app.topics.map((t) => [t.id, t])), [app.topics]);
  const [topic, setTopic] = useSessionState<string>("feedPath.topic", "all");
  const [sort, setSort] = useSessionState<Sort>("feedPath.sort", "latest");
  const [unreadOnly, setUnreadOnly] = useSessionState("feedPath.unread", false);
  const [q, setQ] = useState("");
  const [open, setOpen] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);

  const shown = useMemo(() => {
    let list = feed.entries.filter((e) => (topic === "all" || e.topics.some((t) => t.topic === topic)) && matches(e, q));
    if (unreadOnly) list = list.filter((e) => !app.marks.read[e.id] || e.id === open);
    if (sort === "top") {
      const sc = (e: Entry) => (topic === "all" ? e.score : e.topics.find((t) => t.topic === topic)?.score ?? 0);
      list = [...list].sort((a, b) => sc(b) - sc(a) || b.publishedAt - a.publishedAt);
    }
    return list;
  }, [feed.entries, topic, q, unreadOnly, sort, app.marks.read, open]);

  const unread = (id: string) => feed.entries.filter((e) => !app.marks.read[e.id] && (id === "all" || e.topics.some((t) => t.topic === id))).length;
  const pending = app.links.filter((l) => !l.deletedAt && (!feed.links[l.id] || feed.links[l.id].error));
  const run = feed.runs[0];
  const next = nextRun(Date.now());
  const recentFiltered = feed.filtered.length;

  const groups: { key: string; label: string; items: Entry[] }[] = [];
  if (sort === "latest") {
    for (const e of shown) {
      const k = dayKey(e.publishedAt);
      const g = groups[groups.length - 1];
      if (g && g.key === k) g.items.push(e);
      else groups.push({ key: k, label: dayLabel(e.publishedAt), items: [e] });
    }
  } else groups.push({ key: "top", label: "", items: shown });

  const connected = sync.kind !== "off";

  return (
    <div className="feed">
      <header className="page-head row-head">
        <div>
          <h1 className="display">Feed</h1>
          <p className="muted small">
            {run ? <>Updated {ago(run.at)} · next {nextLabel(next)}</> : connected ? "Waiting for the collector's first run" : "Not connected yet"}
          </p>
        </div>
        <button type="button" className="btn sm" onClick={() => setAdding(true)}><IconLink width={16} height={16} /> Add link</button>
      </header>

      {!connected && feed.entries.length === 0 && (
        <div className="card empty">
          <h2>Connect to see your feed</h2>
          <p className="muted small">The collector writes the feed to a private gist on your GitHub account every morning. Connect this device with your GitHub token to read it.</p>
          <button type="button" className="btn primary" onClick={onOpenSync}>Connect</button>
        </div>
      )}

      {pending.length > 0 && (
        <div className="card pending">
          <h2 className="small-h">Your links</h2>
          <ul className="pending-list">
            {pending.map((l) => {
              const err = feed.links[l.id]?.error;
              return (
                <li key={l.id}>
                  <div>
                    <span className="pending-url" dir="auto">{host(l.url)}<span className="muted">{l.url.replace(/^https?:\/\/[^/]+/, "").slice(0, 60)}</span></span>
                    <span className={`small ${err ? "form-error" : "muted"}`}>{err ? `Couldn't summarize: ${err}` : `Summarized on the next run, ${nextLabel(next)}`}</span>
                  </div>
                  <button type="button" className="icon-btn subtle" aria-label="Remove link" onClick={() => removeLink(l.id)}><IconClose /></button>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {feed.entries.length > 0 && (
        <div className="feed-controls">
          <div className="search-row">
            <label className="search">
              <IconSearch />
              <input type="search" placeholder="Search the feed" aria-label="Search the feed" value={q} onChange={(e) => setQ(e.target.value)} />
              {q && <button type="button" className="search-clear" aria-label="Clear search" onClick={() => setQ("")}><IconClose /></button>}
            </label>
          </div>
          <div className="focus-row" role="group" aria-label="Topic">
            <button type="button" className="chip" aria-pressed={topic === "all"} onClick={() => setTopic("all")}>All <span className="count">{unread("all") || ""}</span></button>
            {topics.map((t: Topic) => (
              <button key={t.id} type="button" className="chip" aria-pressed={topic === t.id} onClick={() => setTopic(t.id)}>
                {t.name} <span className="count">{unread(t.id) || ""}</span>
              </button>
            ))}
          </div>
          <div className="feed-toggles">
            <Seg label="Order" value={sort} onChange={setSort} options={[{ id: "latest", label: "Latest" }, { id: "top", label: "Top" }]} />
            <button type="button" className="chip" aria-pressed={unreadOnly} onClick={() => setUnreadOnly(!unreadOnly)}>Unread only</button>
          </div>
        </div>
      )}

      {connected && feed.entries.length === 0 && pending.length === 0 && (
        <div className="card empty">
          <h2>Nothing here yet</h2>
          <p className="muted small">The first entries appear after the collector's next run. You can start one now from the Actions page on GitHub (open the sync pill above).</p>
        </div>
      )}

      {feed.entries.length > 0 && shown.length === 0 && (
        <p className="muted small pad">{unreadOnly ? "All read here." : "Nothing matches."}</p>
      )}

      {groups.map((g) => (
        <section key={g.key} className="day" aria-label={g.label || "Top stories"}>
          {g.label && <h2 className="day-head">{g.label}</h2>}
          <div className="entries">
            {g.items.map((e) => (
              <EntryCard key={e.id} entry={e} topics={topicMap} open={open === e.id} onToggle={() => setOpen(open === e.id ? null : e.id)} />
            ))}
          </div>
        </section>
      ))}

      {shown.length > 0 && (
        <div className="feed-foot">
          {shown.some((e) => !app.marks.read[e.id]) && (
            <button type="button" className="btn ghost" onClick={() => markAllRead(shown.map((e) => e.id))}>Mark these as read</button>
          )}
          {recentFiltered > 0 && (
            <a className="link" href="#feed/filtered">{recentFiltered} headlines filtered out in the last 2 days</a>
          )}
        </div>
      )}

      {adding && <AddLinkSheet onClose={() => setAdding(false)} />}
    </div>
  );
}

function AddLinkSheet({ onClose }: { onClose: () => void }) {
  const [url, setUrl] = useState("");
  const [done, setDone] = useState(false);
  const valid = /^(https?:\/\/)?[^\s/]+\.[^\s]+$/i.test(url.trim());
  function submit(e: FormEvent) {
    e.preventDefault();
    if (!valid) return;
    addLink(url);
    setUrl("");
    setDone(true);
  }
  return (
    <Sheet title="Summarize a link" onClose={onClose}>
      <p className="muted small">An article or a YouTube video. It's summarized on the collector's next run and added to the feed, whatever its topic.</p>
      <form className="token-form" onSubmit={submit}>
        <input type="url" inputMode="url" autoCapitalize="off" spellCheck={false} placeholder="https://…" aria-label="Link" value={url} onChange={(e) => { setUrl(e.target.value); setDone(false); }} autoFocus />
        <button className="btn primary" type="submit" disabled={!valid}>Add</button>
      </form>
      {done && <p className="small" role="status">Added. It shows under Your links until it's summarized.</p>}
    </Sheet>
  );
}

function Filtered() {
  const feed = useFeed();
  const app = useAppState();
  const topicMap = new Map(app.topics.map((t) => [t.id, t]));
  return (
    <div className="feed">
      <a className="back" href="#feed"><IconBack /> Feed</a>
      <header className="page-head">
        <h1 className="display">Filtered out</h1>
        <p className="muted small">
          Headlines from the last 2 days that scored below every topic's threshold. If good ones end up here, lower that topic's threshold in Topics.
        </p>
      </header>
      {feed.filtered.length === 0 ? (
        <p className="muted small pad">Nothing filtered out.</p>
      ) : (
        <ul className="card list filtered">
          {feed.filtered.map((f, i) => {
            const t = f.topic ? topicMap.get(f.topic) : undefined;
            return (
              <li key={`${f.url}-${i}`}>
                <a href={safeUrl(f.url)} target="_blank" rel="noopener noreferrer">
                  <span className="src-title" dir="auto">{f.title} <IconExternal /></span>
                  <span className="muted small">
                    {f.sourceName} · {ago(f.at)}{" "}
                    {t ? <span className={scoreClass(f.score)}>{t.name} · {f.score}</span> : <span className="score">no topic</span>}
                  </span>
                </a>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
