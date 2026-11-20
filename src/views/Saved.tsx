/* Saved entries: copies kept in the app's own file, so they stay after the feed drops them. */
import { useMemo, useState } from "react";
import type { Entry } from "../../shared/types";
import { EntryCard } from "../components/EntryCard";
import { useAppState } from "../state/store";

export function Saved() {
  const app = useAppState();
  const topicMap = useMemo(() => new Map(app.topics.map((t) => [t.id, t])), [app.topics]);
  const [open, setOpen] = useState<string | null>(null);
  const saved = Object.values(app.marks.saved)
    .filter((m): m is typeof m & { entry: Entry } => m.on && !!m.entry)
    .sort((a, b) => b.at - a.at);

  return (
    <div className="feed">
      <header className="page-head">
        <h1 className="display">Saved</h1>
        <p className="muted small">{saved.length ? `${saved.length} saved` : "Open an entry and press Save to keep it here for good."}</p>
      </header>
      <div className="entries">
        {saved.map(({ entry }) => (
          <EntryCard key={entry.id} entry={entry} topics={topicMap} open={open === entry.id} onToggle={() => setOpen(open === entry.id ? null : entry.id)} />
        ))}
      </div>
    </div>
  );
}
