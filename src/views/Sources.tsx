/* Sources: add by URL (YouTube channel, site or feed) or as a Google News search; each shows how its
   last run went. Tap one to rename it, change its URL or topics, turn it off or remove it. */
import { useState, type FormEvent } from "react";
import type { Edition, Source, SourceHealth, SourceKind } from "../../shared/types";
import { IconVideo } from "../components/Icons";
import { Seg, Sheet, Switch } from "../components/ui";
import { addSource, deleteSource, editSource, liveSources, liveTopics, sourceFromUrl } from "../state/actions";
import { useFeed } from "../state/feed";
import { useAppState } from "../state/store";
import { showToast } from "../lib/toast";
import { host } from "../lib/text";
import { ago } from "../lib/time";

const GROUPS: { kind: SourceKind; label: string }[] = [
  { kind: "youtube", label: "YouTube channels" },
  { kind: "rss", label: "Sites & feeds" },
  { kind: "search", label: "News searches" },
];

const EDITIONS: { id: Edition; label: string }[] = [{ id: "en-US", label: "English" }, { id: "he-IL", label: "Hebrew" }];

function healthLine(h: SourceHealth | undefined, s: Source) {
  if (!s.enabled) return { text: "Off", bad: false };
  if (!h) return { text: "Read on the next run", bad: false };
  if (!h.ok) return { text: h.error ?? "Failed on the last run", bad: true };
  return { text: `${h.newItems} new when last read, ${ago(h.lastRun)}`, bad: false };
}

export function Sources() {
  const app = useAppState();
  const feed = useFeed();
  const sources = liveSources(app.sources);
  const topics = new Map(app.topics.map((t) => [t.id, t]));
  const [url, setUrl] = useState("");
  const [searching, setSearching] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);

  function add(e: FormEvent) {
    e.preventDefault();
    if (!url.trim()) return;
    const guess = sourceFromUrl(url);
    const id = addSource(guess);
    setUrl("");
    showToast(`Added ${guess.name}`);
    setEditing(id);
  }

  const failing = sources.filter((s) => s.enabled && feed.health[s.id] && !feed.health[s.id].ok).length;

  return (
    <div className="feed">
      <header className="page-head">
        <h1 className="display">Sources</h1>
        <p className="muted small">
          {sources.filter((s) => s.enabled).length} on{failing ? ` · ${failing} failing` : ""}. Sources are read every 3 hours and summarized each morning.
        </p>
      </header>

      <form className="card add-form" onSubmit={add}>
        <label className="field">
          <span className="small">Add a YouTube channel, site or feed</span>
          <div className="token-form">
            <input type="text" inputMode="url" autoCapitalize="off" spellCheck={false} placeholder="youtube.com/@name, a site or feed" value={url} onChange={(e) => setUrl(e.target.value)} />
            <button className="btn primary" type="submit" disabled={!url.trim()}>Add</button>
          </div>
        </label>
        <button type="button" className="text-btn" onClick={() => setSearching(true)}>Or follow a Google News search…</button>
      </form>

      {GROUPS.map(({ kind, label }) => {
        const list = sources.filter((s) => s.kind === kind);
        if (!list.length) return null;
        return (
          <section key={kind} className="group">
            <h2 className="day-head">{label}</h2>
            <ul className="card list">
              {list.map((s) => {
                const h = healthLine(feed.health[s.id], s);
                return (
                  <li key={s.id} className={`src-row${s.enabled ? "" : " off"}`}>
                    <button type="button" className="src-main" onClick={() => setEditing(s.id)}>
                      <span className="src-name">{s.kind === "youtube" && <IconVideo />}{s.name}</span>
                      <span className="muted small" dir="auto">{s.kind === "search" ? `“${s.query}” · ${s.edition === "he-IL" ? "Hebrew" : "English"}` : host(s.url ?? "")}</span>
                      <span className={`small ${h.bad ? "form-error" : "muted"}`}>{h.text}</span>
                      {!!s.topics?.length && (
                        <span className="mini-tags">{s.topics.map((t) => topics.get(t)).filter(Boolean).map((t) => <span key={t!.id} className="tag">{t!.name}</span>)}</span>
                      )}
                    </button>
                    <Switch on={s.enabled} label={`${s.name} on`} onChange={(on) => editSource(s.id, (x) => { x.enabled = on; })} />
                  </li>
                );
              })}
            </ul>
          </section>
        );
      })}

      {editing && <SourceSheet id={editing} onClose={() => setEditing(null)} />}
      {searching && <SearchSheet onClose={() => setSearching(false)} />}
    </div>
  );
}

function TopicChips({ value, onChange }: { value: string[]; onChange: (v: string[]) => void }) {
  const app = useAppState();
  return (
    <div className="chips" role="group" aria-label="Topics">
      {liveTopics(app.topics).map((t) => {
        const on = value.includes(t.id);
        return (
          <button key={t.id} type="button" className="chip" aria-pressed={on} onClick={() => onChange(on ? value.filter((x) => x !== t.id) : [...value, t.id])}>{t.name}</button>
        );
      })}
    </div>
  );
}

function SourceSheet({ id, onClose }: { id: string; onClose: () => void }) {
  const app = useAppState();
  const feed = useFeed();
  const s = app.sources.find((x) => x.id === id);
  const [name, setName] = useState(s?.name ?? "");
  const [url, setUrl] = useState(s?.url ?? "");
  const [query, setQuery] = useState(s?.query ?? "");
  if (!s) return null;
  const h = feed.health[s.id];

  const save = () => editSource(s.id, (x) => {
    x.name = name.trim() || x.name;
    if (x.kind === "search") x.query = query.trim() || x.query;
    else x.url = url.trim() || x.url;
  });

  return (
    <Sheet title={s.name} onClose={() => { save(); onClose(); }}>
      <label className="field">
        <span className="small">Name</span>
        <input className="text-input" value={name} onChange={(e) => setName(e.target.value)} dir="auto" />
      </label>
      {s.kind === "search" ? (
        <>
          <label className="field">
            <span className="small">Search phrase</span>
            <input className="text-input" value={query} onChange={(e) => setQuery(e.target.value)} dir="auto" />
          </label>
          <Seg label="Edition" value={s.edition ?? "en-US"} options={EDITIONS} onChange={(v) => editSource(s.id, (x) => { x.edition = v; })} />
        </>
      ) : (
        <label className="field">
          <span className="small">{s.kind === "youtube" ? "Channel URL" : "Site or feed URL"}</span>
          <input className="text-input" value={url} onChange={(e) => setUrl(e.target.value)} inputMode="url" autoCapitalize="off" spellCheck={false} />
          {h?.feedUrl && h.feedUrl !== url && <span className="muted small">Reading {h.feedUrl}</span>}
        </label>
      )}
      <div className="field">
        <span className="small">Usually about</span>
        <TopicChips value={s.topics ?? []} onChange={(v) => editSource(s.id, (x) => { x.topics = v; })} />
        <span className="muted small">A hint for scoring. Items are still scored against every topic.</span>
      </div>
      <div className="row-between">
        <span>On</span>
        <Switch on={s.enabled} label="Source on" onChange={(on) => editSource(s.id, (x) => { x.enabled = on; })} />
      </div>
      {h && (
        <p className={`small ${h.ok ? "muted" : "form-error"}`}>
          {h.ok ? `Last read ${ago(h.lastRun)}: ${h.items} items in its feed, ${h.newItems} new.` : `Last read ${ago(h.lastRun)}: ${h.error}`}
        </p>
      )}
      <div className="dlg-actions">
        <button type="button" className="btn ghost danger" onClick={() => { deleteSource(s.id); onClose(); }}>Remove source</button>
      </div>
    </Sheet>
  );
}

function SearchSheet({ onClose }: { onClose: () => void }) {
  const [query, setQuery] = useState("");
  const [edition, setEdition] = useState<Edition>("en-US");
  const [topicIds, setTopicIds] = useState<string[]>([]);
  function submit(e: FormEvent) {
    e.preventDefault();
    if (!query.trim()) return;
    addSource({ kind: "search", name: `Google News · ${query.trim()}`, query, edition, topics: topicIds });
    showToast("Search added");
    onClose();
  }
  return (
    <Sheet title="Follow a news search" onClose={onClose}>
      <p className="muted small">
        Google News headlines for a phrase. Only the headline can be read (Google's links don't open the article), so these summaries are short.
        Quotes and OR work: <code>"gene therapy" OR senolytics</code>.
      </p>
      <form className="form-grid" onSubmit={submit}>
        <label className="field">
          <span className="small">Search phrase</span>
          <input className="text-input" value={query} onChange={(e) => setQuery(e.target.value)} dir="auto" autoFocus />
        </label>
        <Seg label="Edition" value={edition} options={EDITIONS} onChange={setEdition} />
        <div className="field">
          <span className="small">Usually about</span>
          <TopicChips value={topicIds} onChange={setTopicIds} />
        </div>
        <button className="btn primary" type="submit" disabled={!query.trim()}>Add search</button>
      </form>
    </Sheet>
  );
}
