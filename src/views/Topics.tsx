/* Topics: what I care about, in my words. Claude scores every new item against each description;
   the threshold decides what reaches the feed. Counts from the current feed help tune it. */
import { useState, type FormEvent } from "react";
import { Sheet, Stepper, Switch } from "../components/ui";
import { addTopic, deleteTopic, editTopic, liveTopics } from "../state/actions";
import { useFeed } from "../state/feed";
import { useAppState } from "../state/store";

const DAY = 24 * 3600_000;

export function Topics() {
  const app = useAppState();
  const feed = useFeed();
  const topics = liveTopics(app.topics);
  const [editing, setEditing] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const since = Date.now() - DAY;

  return (
    <div className="feed">
      <header className="page-head row-head">
        <div>
          <h1 className="display">Topics</h1>
          <p className="muted small">Every new item is scored 0–100 for each topic. It reaches the feed when it meets a topic's threshold.</p>
        </div>
        <button type="button" className="btn sm" onClick={() => setAdding(true)}>New topic</button>
      </header>

      {topics.map((t) => {
        const inFeed = feed.entries.filter((e) => e.createdAt >= since && e.topics.some((x) => x.topic === t.id && x.score >= t.minScore)).length;
        const out = feed.filtered.filter((f) => f.topic === t.id).length;
        return (
          <article key={t.id} className={`card topic${t.enabled ? "" : " off"}`}>
            <div className="card-head">
              <h2>{t.name}</h2>
              <Switch on={t.enabled} label={`${t.name} on`} onChange={(on) => editTopic(t.id, (x) => { x.enabled = on; })} />
            </div>
            <p className="muted small" dir="auto">{t.description}</p>
            <div className="topic-foot">
              <Stepper label="Threshold" value={t.minScore} min={20} max={95} step={5} onChange={(v) => editTopic(t.id, (x) => { x.minScore = v; })} />
              <p className="small muted">{inFeed} in the feed from the last day · {out} filtered out in 2 days</p>
            </div>
            <button type="button" className="text-btn" onClick={() => setEditing(t.id)}>Edit</button>
          </article>
        );
      })}

      <p className="muted small pad">
        Scale: 30 related but routine · 50 worth a look · 70 important · 85 a major development. Changes apply from the next run.
      </p>

      {editing && <TopicSheet id={editing} onClose={() => setEditing(null)} />}
      {adding && <NewTopicSheet onClose={() => setAdding(false)} />}
    </div>
  );
}

function TopicSheet({ id, onClose }: { id: string; onClose: () => void }) {
  const app = useAppState();
  const t = app.topics.find((x) => x.id === id);
  const [name, setName] = useState(t?.name ?? "");
  const [desc, setDesc] = useState(t?.description ?? "");
  if (!t) return null;
  const save = () => editTopic(t.id, (x) => { x.name = name.trim() || x.name; x.description = desc.trim() || x.description; });
  return (
    <Sheet title={t.name} onClose={() => { save(); onClose(); }}>
      <label className="field">
        <span className="small">Name</span>
        <input className="text-input" value={name} onChange={(e) => setName(e.target.value)} dir="auto" />
      </label>
      <label className="field">
        <span className="small">What you care about</span>
        <textarea className="text-input" rows={5} value={desc} onChange={(e) => setDesc(e.target.value)} dir="auto" />
        <span className="muted small">Claude reads this to score items. Say what to prefer and what to leave out.</span>
      </label>
      <div className="dlg-actions">
        <button type="button" className="btn ghost danger" onClick={() => { deleteTopic(t.id); onClose(); }}>Remove topic</button>
      </div>
    </Sheet>
  );
}

function NewTopicSheet({ onClose }: { onClose: () => void }) {
  const [name, setName] = useState("");
  const [desc, setDesc] = useState("");
  function submit(e: FormEvent) {
    e.preventDefault();
    if (!name.trim() || !desc.trim()) return;
    addTopic(name, desc);
    onClose();
  }
  return (
    <Sheet title="New topic" onClose={onClose}>
      <form className="form-grid" onSubmit={submit}>
        <label className="field">
          <span className="small">Name</span>
          <input className="text-input" value={name} onChange={(e) => setName(e.target.value)} dir="auto" autoFocus />
        </label>
        <label className="field">
          <span className="small">What you care about</span>
          <textarea className="text-input" rows={4} value={desc} onChange={(e) => setDesc(e.target.value)} dir="auto"
            placeholder="e.g. New AI models and research results; skip funding rounds and product marketing." />
        </label>
        <p className="muted small">
          A topic scores items from every source. To get items it needs, add sources that cover it (a site, a channel or a news search).
        </p>
        <button className="btn primary" type="submit" disabled={!name.trim() || !desc.trim()}>Add topic</button>
      </form>
    </Sheet>
  );
}
