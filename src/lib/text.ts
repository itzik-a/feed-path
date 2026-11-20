/* Small text helpers. */

/** Right-to-left languages (Hebrew, Arabic, Persian, Urdu). */
export const isRtl = (lang?: string) => !!lang && /^(he|iw|ar|fa|ur|yi)\b/i.test(lang);

export function host(url: string): string {
  try { return new URL(url).hostname.replace(/^www\./, ""); } catch { return url; }
}

/** Only http(s) links are rendered as links. */
export const safeUrl = (u: string) => (/^https?:\/\//i.test(u) ? u : undefined);
