/* App state: the synced file feed-path.json (sources, topics, links, my marks, settings), saved to
   localStorage on every change. Every change goes through src/state/actions.ts. New fields must be
   optional in normalize() so older saved copies still load. The feed itself is in src/state/feed.ts. */
import { useSyncExternalStore } from "react";
import { DEFAULT_SETTINGS, seedAppFile } from "../../shared/seed";
import type { AppFile } from "../../shared/types";

export type AppState = AppFile;

const LS = "feedPath.v1";

export const defaults = (): AppState => seedAppFile();

const arr = <T,>(v: unknown): T[] => (Array.isArray(v) ? (v as T[]) : []);
const obj = <T extends object>(v: unknown): T => (v && typeof v === "object" && !Array.isArray(v) ? (v as T) : ({} as T));

export function normalize(s: unknown): AppState {
  const d = defaults();
  if (!s || typeof s !== "object") return d;
  const x = s as Partial<AppState>;
  const m = obj<Partial<AppState["marks"]>>(x.marks);
  return {
    v: 1,
    sources: Array.isArray(x.sources) ? x.sources : d.sources,
    topics: Array.isArray(x.topics) ? x.topics : d.topics,
    links: arr(x.links),
    marks: { read: obj(m.read), saved: obj(m.saved), votes: obj(m.votes) },
    settings: { ...DEFAULT_SETTINGS, ...obj(x.settings) },
    updatedAt: x.updatedAt || 0,
  };
}

function load(): AppState {
  try {
    const raw = localStorage.getItem(LS);
    if (raw) return normalize(JSON.parse(raw));
  } catch { /* fall through */ }
  return defaults();
}

let state: AppState = load();
const listeners = new Set<() => void>();
const localListeners = new Set<() => void>();

const emit = () => listeners.forEach((l) => l());
function saveLocal() {
  try { localStorage.setItem(LS, JSON.stringify(state)); } catch { /* storage full or blocked */ }
}

export const getState = () => state;

export function subscribe(l: () => void) {
  listeners.add(l);
  return () => { listeners.delete(l); };
}

/** Apply a local change: copy, mutate, stamp, save, notify. */
export function update(fn: (draft: AppState) => void) {
  const next = structuredClone(state);
  fn(next);
  next.updatedAt = Date.now();
  state = next;
  saveLocal();
  emit();
  localListeners.forEach((l) => l());
}

/** Called after changes made on this device (not after sync replaces state). */
export function onLocalChange(l: () => void) {
  localListeners.add(l);
  return () => { localListeners.delete(l); };
}

/** Replace state wholesale (sync brought a newer copy). */
export function replaceState(s: unknown) {
  state = normalize(s);
  saveLocal();
  emit();
}

export function useAppState() {
  return useSyncExternalStore(subscribe, getState);
}

/* Keep two open tabs on the same device in step. */
window.addEventListener("storage", (e) => {
  if (e.key === LS && e.newValue) {
    try { state = normalize(JSON.parse(e.newValue)); emit(); } catch { /* ignore */ }
  }
});
