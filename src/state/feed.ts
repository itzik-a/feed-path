/* The feed (feed.json, written only by the collector). Sync reads it from the gist; it's kept in
   localStorage so the app opens offline with the last copy. Read-only in the app. */
import { useSyncExternalStore } from "react";
import type { FeedFile } from "../../shared/types";

const LS = "feedPath.feed";

export const emptyFeed = (): FeedFile => ({ v: 1, updatedAt: 0, entries: [], filtered: [], health: {}, links: {}, runs: [] });

const arr = <T,>(v: unknown): T[] => (Array.isArray(v) ? (v as T[]) : []);
const obj = <T extends object>(v: unknown): T => (v && typeof v === "object" && !Array.isArray(v) ? (v as T) : ({} as T));

export function normalizeFeed(s: unknown): FeedFile {
  const x = obj<Partial<FeedFile>>(s);
  return {
    v: 1, updatedAt: x.updatedAt ?? 0, entries: arr(x.entries), filtered: arr(x.filtered), health: obj(x.health),
    links: obj(x.links), runs: arr(x.runs), lastRead: x.lastRead, waiting: x.waiting,
  };
}

function load(): FeedFile {
  try {
    const raw = localStorage.getItem(LS);
    if (raw) return normalizeFeed(JSON.parse(raw));
  } catch { /* fall through */ }
  return emptyFeed();
}

let feed = load();
let lastText = "";
const listeners = new Set<() => void>();

export const getFeed = () => feed;

/** A newer feed.json arrived. */
export function setFeed(text: string) {
  if (text === lastText) return; // reading-only passes change only health / lastRead, so compare the whole file
  let next: FeedFile;
  try { next = normalizeFeed(JSON.parse(text)); } catch { return; }
  lastText = text;
  feed = next;
  try { localStorage.setItem(LS, text); } catch { /* too big for storage: keep it in memory */ }
  listeners.forEach((l) => l());
}

export function useFeed() {
  return useSyncExternalStore((l) => { listeners.add(l); return () => { listeners.delete(l); }; }, () => feed);
}
