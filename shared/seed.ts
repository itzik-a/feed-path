/* The starting topics and sources, used by the app's defaults and by the collector when the gist
   doesn't exist yet. `updatedAt: 0` so any edit in the app wins. Never rename or reuse these ids:
   marks, health and hints are keyed by them. */
import type { AppFile, Source, Topic } from "./types.ts";

export const SEED_TOPICS: Topic[] = [
  {
    id: "israel", name: "Israeli news", minScore: 70, enabled: true, updatedAt: 0,
    description: "News about Israel: politics, security, the economy and society. Major developments over routine items.",
  },
  {
    id: "usa", name: "US news", minScore: 70, enabled: true, updatedAt: 0,
    description: "US politics, policy, the economy and major events in the United States.",
  },
  {
    id: "world", name: "Global news", minScore: 70, enabled: true, updatedAt: 0,
    description: "Major international events outside Israel and the US: geopolitics, conflicts, elections, the world economy, disasters.",
  },
  {
    id: "longevity", name: "Longevity & health science", minScore: 55, enabled: true, updatedAt: 0,
    description:
      "Research and developments in longevity, the biology of aging and health: new studies, clinical trials, treatments and evidence-based health findings. Prefer peer-reviewed results and real trials over hype, supplements marketing and lifestyle listicles.",
  },
];

const rss = (id: string, name: string, url: string, topics: string[]): Source =>
  ({ id, kind: "rss", name, url, topics, enabled: true, updatedAt: 0 });

export const SEED_SOURCES: Source[] = [
  rss("ynet", "Ynet", "https://www.ynet.co.il/Integration/StoryRss2.xml", ["israel"]),
  rss("toi", "The Times of Israel", "https://www.timesofisrael.com/feed/", ["israel"]),
  rss("npr", "NPR News", "https://feeds.npr.org/1001/rss.xml", ["usa"]),
  rss("nyt-us", "New York Times · U.S.", "https://rss.nytimes.com/services/xml/rss/nyt/US.xml", ["usa"]),
  rss("bbc-world", "BBC News · World", "https://feeds.bbci.co.uk/news/world/rss.xml", ["world"]),
  rss("nyt-world", "New York Times · World", "https://rss.nytimes.com/services/xml/rss/nyt/World.xml", ["world"]),
  rss("sciencedaily-health", "ScienceDaily · Health & Medicine", "https://www.sciencedaily.com/rss/health_medicine.xml", ["longevity"]),
  rss("fightaging", "Fight Aging!", "https://www.fightaging.org/feed/", ["longevity"]),
  rss("lifespan", "Lifespan.io", "https://lifespan.io/feed/", ["longevity"]),
  rss("nature-aging", "Nature Aging", "https://www.nature.com/nataging.rss", ["longevity"]),
  {
    id: "gn-longevity", kind: "search", name: "Google News · longevity research", query: "longevity OR \"aging research\" study",
    edition: "en-US", topics: ["longevity"], enabled: true, updatedAt: 0,
  },
];

export const DEFAULT_SETTINGS = { keepDays: 10 };

export function seedAppFile(): AppFile {
  return {
    v: 1,
    sources: structuredClone(SEED_SOURCES),
    topics: structuredClone(SEED_TOPICS),
    links: [],
    marks: { read: {}, saved: {}, votes: {} },
    settings: { ...DEFAULT_SETTINGS },
    updatedAt: 0,
  };
}
