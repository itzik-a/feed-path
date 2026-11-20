/* Merging two copies of feed-path.json (this device and the gist). Type-only imports, so it can be tested alone.
   - sources, topics, links: per item, the newer `updatedAt` wins (soft deletes win the same way)
   - marks.read: union, latest time; marks older than READ_KEEP are dropped
   - marks.saved, marks.votes: per entry, the newer `at` wins
   - settings: from the copy with the newer top-level `updatedAt` */
import type { AppFile } from "../../shared/types";

const READ_KEEP = 30 * 24 * 3600_000;

function byId<T extends { id: string; updatedAt: number }>(a: T[], b: T[]): T[] {
  const out = new Map<string, T>();
  for (const x of a) out.set(x.id, x);
  for (const y of b) {
    const x = out.get(y.id);
    if (!x || (y.updatedAt || 0) > (x.updatedAt || 0)) out.set(y.id, y);
  }
  return [...out.values()];
}

function byAt<T extends { at: number }>(a: Record<string, T>, b: Record<string, T>): Record<string, T> {
  const out: Record<string, T> = { ...a };
  for (const [k, y] of Object.entries(b)) if (!out[k] || y.at > out[k].at) out[k] = y;
  return out;
}

export function merge(local: AppFile, remote: AppFile, now = Date.now()): AppFile {
  const read: Record<string, number> = {};
  for (const src of [local.marks.read, remote.marks.read]) {
    for (const [k, t] of Object.entries(src)) if (t > now - READ_KEEP) read[k] = Math.max(read[k] ?? 0, t);
  }
  const newer = (remote.updatedAt || 0) > (local.updatedAt || 0) ? remote : local;
  return {
    v: 1,
    sources: byId(local.sources, remote.sources),
    topics: byId(local.topics, remote.topics),
    links: byId(local.links, remote.links),
    marks: { read, saved: byAt(local.marks.saved, remote.marks.saved), votes: byAt(local.marks.votes, remote.marks.votes) },
    settings: newer.settings,
    updatedAt: Math.max(local.updatedAt || 0, remote.updatedAt || 0),
  };
}

/** JSON with object keys sorted, so two copies with the same content compare equal. */
export function serialize(v: unknown): string {
  return JSON.stringify(v, (_k, x: unknown) =>
    x && typeof x === "object" && !Array.isArray(x)
      ? Object.fromEntries(Object.entries(x as Record<string, unknown>).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)))
      : x,
  );
}
