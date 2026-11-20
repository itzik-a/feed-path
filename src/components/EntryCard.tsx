/* One story: meta line, title and TL;DR; tap to open the bullets, why it matters, every source, and actions.
   Summary text follows the entry's language direction (Hebrew right-to-left). */
import type { Entry, EntrySource, Topic } from "../../shared/types";
import { markRead, markUnread, toggleSave, vote } from "../state/actions";
import { useAppState } from "../state/store";
import { isRtl, safeUrl } from "../lib/text";
import { ago } from "../lib/time";
import { IconDown, IconExternal, IconSaved, IconSavedFill, IconUp, IconVideo } from "./Icons";

const BASIS: Record<EntrySource["basis"], string> = {
  full: "",
  excerpt: "summary from the excerpt only",
  description: "from the video description",
  headline: "headline only",
};

export function scoreClass(score: number) {
  return score >= 85 ? "score hi" : score >= 70 ? "score mid" : "score";
}

export function EntryCard({ entry, topics, open, onToggle }: { entry: Entry; topics: Map<string, Topic>; open: boolean; onToggle: () => void }) {
  const { marks } = useAppState();
  const read = !!marks.read[entry.id];
  const saved = !!marks.saved[entry.id]?.on;
  const myVote = marks.votes[entry.id]?.v ?? 0;
  const dir = isRtl(entry.lang) ? "rtl" : "ltr";
  const top = entry.topics[0];
  const topic = top && topics.get(top.topic);
  const first = entry.sources[0];
  const others = new Set(entry.sources.map((s) => s.sourceName)).size - 1;
  const image = entry.image && safeUrl(entry.image);

  const toggle = () => { if (!open) markRead(entry.id); onToggle(); };

  return (
    <article className={`entry card${read && !open ? " read" : ""}${open ? " open" : ""}`} aria-labelledby={`t-${entry.id}`}>
      <button type="button" className="entry-toggle" aria-expanded={open} onClick={toggle}>
        <span className="entry-meta">
          {!read && <span className="unread-dot" aria-label="Unread" />}
          {topic && <span className={scoreClass(top.score)} title={`${topic.name}: scored ${top.score} of 100`}>{topic.name} · {top.score}</span>}
          {entry.requested && <span className="tag accent">Your link</span>}
          <span className="entry-src">
            {first?.kind === "video" && <IconVideo />}
            {first?.sourceName}{others > 0 && ` +${others}`}
          </span>
          <span className="muted">· {ago(entry.publishedAt)}</span>
        </span>
        <span className="entry-body">
          <span className="entry-text" dir={dir}>
            <span className="entry-title" id={`t-${entry.id}`}>{entry.title}</span>
            <span className="entry-tldr">{entry.tldr}</span>
          </span>
          {image && !open && <img className="entry-thumb" src={image} alt="" loading="lazy" referrerPolicy="no-referrer" />}
        </span>
      </button>

      {open && (
        <div className="entry-more">
          {entry.bullets.length > 0 && (
            <ul className="bullets" dir={dir}>{entry.bullets.map((b, i) => <li key={i}>{b}</li>)}</ul>
          )}
          {entry.why && (
            <div className="why" dir={dir}>
              <span className="eyebrow">{dir === "rtl" ? "למה זה חשוב" : "Why it matters"}</span>
              <p>{entry.why}</p>
            </div>
          )}
          <div className="entry-sources">
            <span className="eyebrow">{entry.sources.length === 1 ? "Source" : `${entry.sources.length} sources`}</span>
            <ul>
              {entry.sources.map((s) => {
                const href = safeUrl(s.url);
                return (
                  <li key={s.url}>
                    <a href={href} target="_blank" rel="noopener noreferrer">
                      <span className="src-name">{s.kind === "video" && <IconVideo />}{s.sourceName} <IconExternal /></span>
                      <span className="src-title" dir="auto">{s.title}</span>
                    </a>
                    <span className="muted small">{ago(s.publishedAt)}{BASIS[s.basis] && ` · ${BASIS[s.basis]}`}</span>
                  </li>
                );
              })}
            </ul>
          </div>
          {entry.topics.length > 1 && (
            <p className="muted small">
              Scores: {entry.topics.map((t) => `${topics.get(t.topic)?.name ?? t.topic} ${t.score}`).join(" · ")}
            </p>
          )}
          <div className="entry-actions">
            <button type="button" className={`btn sm${saved ? " on" : ""}`} aria-pressed={saved} onClick={() => toggleSave(entry)}>
              {saved ? <IconSavedFill width={16} height={16} /> : <IconSaved width={16} height={16} />} {saved ? "Saved" : "Save"}
            </button>
            <button type="button" className={`icon-btn subtle${myVote === 1 ? " on" : ""}`} aria-pressed={myVote === 1} aria-label="More like this" onClick={() => vote(entry.id, 1)}><IconUp /></button>
            <button type="button" className={`icon-btn subtle${myVote === -1 ? " on" : ""}`} aria-pressed={myVote === -1} aria-label="Less like this" onClick={() => vote(entry.id, -1)}><IconDown /></button>
            <button type="button" className="text-btn" onClick={() => { markUnread(entry.id); onToggle(); }}>Mark unread</button>
          </div>
        </div>
      )}
    </article>
  );
}
