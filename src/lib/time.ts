/* Time labels: "5 min ago", "3 h ago", "Yesterday", "Mon 18 Nov". */
const MIN = 60_000;
const HOUR = 60 * MIN;
const DAY = 24 * HOUR;

export function ago(t: number, now = Date.now()): string {
  const d = now - t;
  if (d < MIN) return "just now";
  if (d < HOUR) return `${Math.round(d / MIN)} min ago`;
  if (d < DAY) return `${Math.round(d / HOUR)} h ago`;
  if (d < 2 * DAY) return "yesterday";
  return new Date(t).toLocaleDateString(undefined, { day: "numeric", month: "short" });
}

export const clock = (t: number) => new Date(t).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });

const dayKey = (t: number) => new Date(t).toLocaleDateString("en-CA");

/** Heading for a day group. */
export function dayLabel(t: number, now = Date.now()): string {
  if (dayKey(t) === dayKey(now)) return "Today";
  if (dayKey(t) === dayKey(now - DAY)) return "Yesterday";
  return new Date(t).toLocaleDateString(undefined, { weekday: "long", day: "numeric", month: "long" });
}

export { dayKey };
