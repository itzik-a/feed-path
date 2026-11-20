/* Every change to the app state goes through here. Each edit stamps the item's `updatedAt`, which sync merges by. */
import type { Edition, Entry, Source, SourceKind, Topic } from "../../shared/types";
import { showToast } from "../lib/toast";
import { uid } from "../lib/uid";
import { getState, update } from "./store";

// ── sources ───────────────────────────────────────────────────

/** Guess a source's kind and a first name from what was pasted. */
export function sourceFromUrl(raw: string): { kind: SourceKind; url: string; name: string } {
  let input = raw.trim();
  if (/^@[\w.-]+$/.test(input)) return { kind: "youtube", url: `https://www.youtube.com/${input}`, name: input.slice(1) };
  if (!/^https?:\/\//i.test(input)) input = `https://${input}`;
  let host = "";
  let path = "";
  try { const u = new URL(input); host = u.hostname.replace(/^www\.|^m\./, ""); path = u.pathname; } catch { /* keep raw */ }
  if (/(^|\.)youtube\.com$/.test(host)) {
    const handle = /^\/@([^/]+)/.exec(path)?.[1] ?? /^\/(?:c|user)\/([^/]+)/.exec(path)?.[1];
    return { kind: "youtube", url: input, name: handle ? decodeURIComponent(handle) : "YouTube channel" };
  }
  return { kind: "rss", url: input, name: host || input };
}

export function addSource(s: { kind: SourceKind; name: string; url?: string; query?: string; edition?: Edition; topics?: string[] }) {
  const id = uid();
  update((d) => {
    d.sources.push({ id, kind: s.kind, name: s.name.trim() || "Untitled", url: s.url?.trim(), query: s.query?.trim(), edition: s.edition, topics: s.topics ?? [], enabled: true, updatedAt: Date.now() });
  });
  return id;
}

export function editSource(id: string, fn: (s: Source) => void) {
  update((d) => {
    const s = d.sources.find((x) => x.id === id);
    if (s) { fn(s); s.updatedAt = Date.now(); }
  });
}

export function deleteSource(id: string) {
  const s = getState().sources.find((x) => x.id === id);
  if (!s) return;
  editSource(id, (x) => { x.deletedAt = Date.now(); });
  showToast(`Removed ${s.name}`, { label: "Undo", run: () => editSource(id, (x) => { delete x.deletedAt; }) });
}

export const liveSources = (sources: Source[]) => sources.filter((s) => !s.deletedAt);

// ── topics ────────────────────────────────────────────────────

export function addTopic(name: string, description: string) {
  const id = uid();
  update((d) => { d.topics.push({ id, name: name.trim(), description: description.trim(), minScore: 60, enabled: true, updatedAt: Date.now() }); });
  return id;
}

export function editTopic(id: string, fn: (t: Topic) => void) {
  update((d) => {
    const t = d.topics.find((x) => x.id === id);
    if (t) { fn(t); t.updatedAt = Date.now(); }
  });
}

export function deleteTopic(id: string) {
  const t = getState().topics.find((x) => x.id === id);
  if (!t) return;
  editTopic(id, (x) => { x.deletedAt = Date.now(); });
  showToast(`Removed ${t.name}`, { label: "Undo", run: () => editTopic(id, (x) => { delete x.deletedAt; }) });
}

export const liveTopics = (topics: Topic[]) => topics.filter((t) => !t.deletedAt);

// ── links ─────────────────────────────────────────────────────

export function addLink(raw: string) {
  let url = raw.trim();
  if (!/^https?:\/\//i.test(url)) url = `https://${url}`;
  const now = Date.now();
  update((d) => { d.links.push({ id: uid(), url, addedAt: now, updatedAt: now }); });
}

export function removeLink(id: string) {
  update((d) => {
    const l = d.links.find((x) => x.id === id);
    if (l) { l.deletedAt = Date.now(); l.updatedAt = l.deletedAt; }
  });
}

// ── marks ─────────────────────────────────────────────────────

export function markRead(id: string) {
  if (getState().marks.read[id]) return;
  update((d) => { d.marks.read[id] = Date.now(); });
}

export function markAllRead(ids: string[]) {
  const now = Date.now();
  update((d) => { for (const id of ids) d.marks.read[id] ??= now; });
}

export function markUnread(id: string) {
  update((d) => { delete d.marks.read[id]; });
}

export const isSaved = (id: string) => !!getState().marks.saved[id]?.on;

export function toggleSave(entry: Entry) {
  const on = !isSaved(entry.id);
  update((d) => { d.marks.saved[entry.id] = on ? { at: Date.now(), on: true, entry } : { at: Date.now(), on: false }; });
  showToast(on ? "Saved" : "Removed from Saved", on ? undefined : { label: "Undo", run: () => toggleSave(entry) });
}

export function vote(id: string, v: 1 | -1) {
  const cur = getState().marks.votes[id]?.v ?? 0;
  update((d) => { d.marks.votes[id] = { at: Date.now(), v: cur === v ? 0 : v }; });
}

// ── settings ──────────────────────────────────────────────────

export function setKeepDays(n: number) {
  update((d) => { d.settings.keepDays = Math.max(2, Math.min(30, Math.round(n))); });
}
