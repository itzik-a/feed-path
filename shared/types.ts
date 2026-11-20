/* Types shared by the app (src/) and the collector (collector/).
   Types only, no runtime code: import them with `import type`.

   One private gist holds three files, each with a single writer:
   - feed-path.json  (AppFile)        written by the app: sources, topics, links, my marks, settings
   - feed.json       (FeedFile)       written by the collector: entries, filtered headlines, source health, runs
   - collector.json  (CollectorState) written by the collector: what it has seen, resolved feed URLs */

export type SourceKind = "youtube" | "rss" | "search";

/** Google News edition used by a "search" source. */
export type Edition = "en-US" | "he-IL";

/** Something specific to follow. */
export interface Source {
  id: string;
  kind: SourceKind;
  name: string;
  /** youtube / rss: what I pasted (a channel URL or @handle, a site or feed URL) */
  url?: string;
  /** search: the phrase looked up on Google News */
  query?: string;
  /** search: which Google News edition (language + country) */
  edition?: Edition;
  /** topic ids this source usually belongs to: a hint for scoring, not a filter */
  topics?: string[];
  enabled: boolean;
  updatedAt: number;
  /** set instead of removing, so the delete syncs */
  deletedAt?: number;
}

/** A subject of interest. Claude scores every new item against each topic's description. */
export interface Topic {
  id: string;
  name: string;
  /** what I care about in this topic, in my own words */
  description: string;
  /** a story stays out of the feed unless it scores at least this for some topic (0–100) */
  minScore: number;
  enabled: boolean;
  updatedAt: number;
  deletedAt?: number;
}

/** A single link to summarize once (pasted in the app; later also sent to the Telegram bot). */
export interface LinkRequest {
  id: string;
  url: string;
  addedAt: number;
  updatedAt: number;
  deletedAt?: number;
}

export interface Settings {
  /** entries older than this many days drop out of feed.json (saved ones are kept in the app's file) */
  keepDays: number;
}

export interface SavedMark { at: number; on: boolean; entry?: Entry }
export interface Vote { at: number; v: 1 | -1 | 0 }

export interface Marks {
  /** entry id → when I opened it */
  read: Record<string, number>;
  /** entry id → saved or not; the newer `at` wins when merging. A saved entry keeps a copy, so it outlives the feed. */
  saved: Record<string, SavedMark>;
  /** entry id → 👍 / 👎 (0 = cleared); newer `at` wins */
  votes: Record<string, Vote>;
}

/** feed-path.json */
export interface AppFile {
  v: 1;
  sources: Source[];
  topics: Topic[];
  links: LinkRequest[];
  marks: Marks;
  settings: Settings;
  updatedAt: number;
}

export interface TopicScore { topic: string; score: number }

export interface EntrySource {
  url: string;
  title: string;
  sourceId: string;
  sourceName: string;
  kind: "article" | "video" | "headline";
  publishedAt: number;
  /** what the summary could read: the full text, the feed's excerpt, the video description, or only the headline */
  basis: "full" | "excerpt" | "description" | "headline";
}

/** One story in the feed. */
export interface Entry {
  id: string;
  title: string;
  /** one sentence */
  tldr: string;
  bullets: string[];
  /** why it matters for the topic it scored highest on; may be empty */
  why?: string;
  /** BCP-47 code of the language the summary is written in (the main source's language) */
  lang: string;
  topics: TopicScore[];
  /** highest topic score */
  score: number;
  /** every source that covered this story, first one = the one summarized first */
  sources: EntrySource[];
  image?: string;
  /** earliest source time */
  publishedAt: number;
  createdAt: number;
  updatedAt: number;
  /** a link I asked for (always kept, whatever its score) */
  requested?: boolean;
}

/** A headline that scored too low for the feed, kept for two days so thresholds can be tuned. */
export interface Filtered {
  title: string;
  url: string;
  sourceName: string;
  score: number;
  topic?: string;
  at: number;
}

export interface SourceHealth {
  lastRun: number;
  ok: boolean;
  /** items in the source's feed on the last run */
  items: number;
  /** of those, new to the collector */
  newItems: number;
  error?: string;
  feedUrl?: string;
}

export interface RunInfo {
  at: number;
  ms: number;
  /** new items looked at */
  candidates: number;
  /** new entries added */
  added: number;
  /** items that joined an existing entry as another source */
  merged: number;
  /** items that scored below every topic's threshold */
  dropped: number;
  errors: string[];
  tokens?: { in: number; out: number };
  dry?: boolean;
  /** started by the daily schedule (not by hand) */
  scheduled?: boolean;
}

/** feed.json */
export interface FeedFile {
  v: 1;
  /** when the last full (Claude) run wrote it */
  updatedAt: number;
  /** when the sources were last read (a reading-only pass or a full run) */
  lastRead?: number;
  /** new items saved by reading-only passes, waiting for the morning run */
  waiting?: number;
  entries: Entry[];
  filtered: Filtered[];
  health: Record<string, SourceHealth>;
  /** link request id → what happened to it */
  links: Record<string, { at: number; entryId?: string; error?: string }>;
  /** newest first, the last 20 */
  runs: RunInfo[];
}

/** A new item read from a source, before Claude has looked at it. */
export interface PendingItem {
  /** stable id for "seen": hash of the canonical URL (or the guid) */
  key: string;
  sourceId: string;
  sourceName: string;
  kind: "article" | "video" | "headline";
  url: string;
  title: string;
  /** the feed's description / excerpt / video description, as plain text */
  snippet: string;
  publishedAt: number;
  image?: string;
  /** topic ids from the source */
  hints: string[];
}

/** collector.json */
export interface CollectorState {
  v: 1;
  /** item key → when Claude looked at it; pruned after a week */
  seen: Record<string, number>;
  /** source id → the feed URL found for what was pasted */
  resolved: Record<string, { input: string; feedUrl: string }>;
  /** items saved by reading-only passes (and ones a morning run couldn't finish), for the next morning run */
  pending: PendingItem[];
}
