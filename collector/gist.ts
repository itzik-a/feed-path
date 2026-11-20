/* Reading and writing the private gist from the collector (GitHub REST API, classic token with the gist scope). */
const API = "https://api.github.com";
export const APP_FILE = "feed-path.json";
export const FEED_FILE = "feed.json";
export const STATE_FILE = "collector.json";
const DESC = "Feed Path data (written by the app and the collector)";

interface GistFile { content?: string; truncated?: boolean; raw_url?: string }
interface Gist { id: string; files: Record<string, GistFile | undefined> }

async function gh<T>(token: string, path: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(API + path, {
    ...init,
    signal: AbortSignal.timeout(30_000),
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
      "User-Agent": "feed-path-collector",
      ...(init.body ? { "Content-Type": "application/json" } : {}),
    },
  });
  if (!res.ok) {
    let msg = res.statusText;
    try { msg = ((await res.json()) as { message?: string }).message || msg; } catch { /* not JSON */ }
    throw new Error(`GitHub ${res.status} on ${path}: ${msg}`);
  }
  return res.json() as Promise<T>;
}

/** The gist holding feed-path.json (the same one the app finds), or a new private one with `seed` as its first files. */
export async function findOrCreateGist(token: string, seed: Record<string, string>): Promise<string> {
  for (let page = 1; page <= 10; page++) {
    const list = await gh<Gist[]>(token, `/gists?per_page=100&page=${page}`);
    const hit = list.find((g) => g.files[APP_FILE]);
    if (hit) return hit.id;
    if (list.length < 100) break;
  }
  const files = Object.fromEntries(Object.entries(seed).map(([k, v]) => [k, { content: v }]));
  const g = await gh<Gist>(token, "/gists", { method: "POST", body: JSON.stringify({ description: DESC, public: false, files }) });
  console.log(`Created gist ${g.id}`);
  return g.id;
}

/** Every file's text. The API cuts files over 1 MB short; those are read from their raw URL. */
export async function readGist(token: string, id: string): Promise<Record<string, string | undefined>> {
  const g = await gh<Gist>(token, `/gists/${id}`);
  const out: Record<string, string | undefined> = {};
  for (const [name, f] of Object.entries(g.files)) {
    if (!f) continue;
    if (f.truncated && f.raw_url) {
      const r = await fetch(f.raw_url, { signal: AbortSignal.timeout(30_000) });
      out[name] = r.ok ? await r.text() : undefined;
    } else out[name] = f.content;
  }
  return out;
}

/** Replace only the named files; the app's own file is never touched here. */
export async function writeGist(token: string, id: string, files: Record<string, string>) {
  await gh(token, `/gists/${id}`, {
    method: "PATCH",
    body: JSON.stringify({ files: Object.fromEntries(Object.entries(files).map(([k, v]) => [k, { content: v }])) }),
  });
}
