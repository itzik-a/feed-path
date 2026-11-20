# Feed Path: plan

A personal feed of the topics I care about and the specific sources I follow (YouTube channels, news sites, blogs, single links). Every entry is summarized, with links to every source that covered it, and Telegram messages go out for things I choose. Installable on the iPhone Home Screen and usable in the browser on the MacBook.

## 1. Concepts

| Thing | What it is | Example |
|---|---|---|
| **Source** | Something specific to follow: a YouTube channel, a site's feed, a Google News search | Ynet, @veritasium, "longevity research" |
| **Topic** | A subject of interest, in my words. Every new item is scored 0–100 against each topic; a threshold decides what reaches the feed | "Longevity & health science", threshold 55 |
| **Link** | A single URL to summarize once, whatever its topic | An article pasted in the app |
| **Entry** | One story: title, one-line TL;DR, 2–5 bullets, why it matters, topic scores, and every source that covered it | |
| **Alert rule** | What sends a Telegram message (milestone 6) | "Israeli news ≥ 85", "every new video from X" |

## 2. How it works

```
GitHub Actions: read every 3 h, Claude daily ~09:30  Private gist
┌───────────────────────────────────────┐            ┌────────────────────┐
│ read config, seen list                 │◄───────────│ feed-path.json     │◄── the app writes
│ read every source's feed               │            │ feed.json          │──► the app reads
│ triage with Claude: scores, same story │───────────►│ collector.json     │
│ summarize new stories that pass        │            └────────────────────┘
│ (later) alert rules → Telegram         │
└───────────────────────────────────────┘
```

Triage first, then summaries: every new headline is scored in batches of 50 (cheap), and only stories that reach a topic's threshold get their article fetched and summarized. The same story from several sources becomes one entry with all their links.

## 3. Starting topics and sources (`shared/seed.ts`)

| Topic | Threshold | Sources |
|---|---|---|
| Israeli news | 70 | Ynet (Hebrew), The Times of Israel |
| US news | 70 | NPR News, New York Times · U.S. |
| Global news | 70 | BBC News · World, New York Times · World |
| Longevity & health science | 55 | ScienceDaily · Health & Medicine, Fight Aging!, Lifespan.io, Nature Aging, Google News search "longevity OR "aging research" study" |

More to add later from the app (Sources: paste a channel, site or feed URL; or follow a Google News search in English or Hebrew).

## 4. Milestones

1. **Repo + plan + scaffold** (done): same stack as piano-path / workout-path, PWA, Pages deploy workflow.
2. **Collector** (done): YouTube / RSS / Atom / RDF / Google News sources, feed discovery from a site URL, article text extraction, seen tracking, gist read / write, scheduled workflow.
3. **Summaries** (done): Claude Haiku 5.5 triage (per-topic scores + same-story grouping) and summaries in the source's language, structured outputs.
4. **Feed app** (done): Feed (topics, search, Latest / Top, unread), entry details, Saved, sync, collector status.
5. **Sources and Topics in the app** (done): add / edit / turn off / remove, health per source, thresholds, filtered-out list for tuning.
6. **Telegram alerts** (next): bot token + chat id as repo secrets; sent after the morning run, by 10:00; rules (source, topic ≥ score, keyword, major news, the morning digest); quiet hours (held until morning), a daily cap, one alert per story. Rules edited in the app (in `feed-path.json`), sent by the collector, sent alerts recorded in `collector.json`.
7. **Bot inbound**: send a link to the bot → summarized on the next run; `/digest`, `/mute <source>`, `/pause 1d` (read with `getUpdates` on each run).

Status 2026-11-20: 1–5 built and checked locally (dry runs against the real feeds, UI on phone and desktop widths, light and dark, Hebrew). Not yet run with Claude or deployed: needs the GitHub repo and the two secrets.

## 5. Follow-ups

- **Learn from 👍 / 👎**: votes are already saved (`marks.votes`); feed recent ones to triage as examples of what I want more / less of.
- **Re-summarize a growing story**: when an important entry gains new sources, refresh its summary.
- **Instant bot replies**: a small Cloudflare Worker webhook, so the bot answers in seconds instead of on the next run.
- **More source types**: podcasts (RSS + transcript), Reddit, newsletters by email, pages without RSS (watched for changes).
- **YouTube transcripts**: summaries use the video description today; transcripts are often blocked from cloud servers.
- **Weekly briefing per topic**: "what changed this week in X".
- **Ask the feed**: questions over saved entries.
- **Archive**: monthly files in the gist, with full-text search.
- **Batch API** for the summaries (half price) if cost ever matters.

## 6. Decisions (2026-11-20)

- **Name**: feed-path.
- **Summary language**: the source's own language (Hebrew stays Hebrew), shown right-to-left when needed.
- **Model**: Claude Haiku 5.5 (`claude-haiku-5-5`) at low effort. Estimated ~$1.30 a month with the starting sources (~180 new items a day, ~45 summaries); Opus 5.5 would be ~$50; every run logs its tokens and cost, and the app shows the last 12 runs' total.
- **Schedule**: Claude once a day, around 09:30 Israel time, so the feed and the morning Telegram messages are ready by 10:00. The sources are read every 3 hours without Claude (free on Actions) and the new items saved for the morning, because Ynet's feed only reaches back ~16 h, The Times of Israel's ~12 h and NPR's ~16 h (measured 2026-11-20). Was every 2 hours with Claude each time.
- **Telegram**: a new bot from @BotFather (milestone 6).
- **Where things run**: GitHub only (Pages + Actions + a private gist); no server.
- **Sites that block article fetches** (The Times of Israel, paywalls) are summarized from the feed's excerpt; no workarounds.
