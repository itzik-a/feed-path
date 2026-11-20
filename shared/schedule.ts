/* When the collector runs: once a day, around 09:30 Israel time, so the feed (and later the Telegram
   messages) is ready by 10:00. GitHub's cron is in UTC and Israel moves its clocks, so collect.yml
   fires at both CRON_UTC times; a scheduled run goes ahead only on the first one at or after
   RUN_HOUR local time that day (isMorningSlot). Keep CRON_UTC in step with collect.yml. */

export const RUN_TZ = "Asia/Jerusalem";
export const RUN_HOUR = 9;
/** [hour, minute] in UTC: 06:30 is 09:30 in summer (UTC+3), 07:30 is 09:30 in winter (UTC+2). */
export const CRON_UTC: [number, number][] = [[6, 30], [7, 30]];

const fmt = new Intl.DateTimeFormat("en-CA", { timeZone: RUN_TZ, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", hourCycle: "h23" });

/** Local date (YYYY-MM-DD) and hour in Israel. */
export function localParts(t: number): { date: string; hour: number } {
  const p = Object.fromEntries(fmt.formatToParts(new Date(t)).map((x) => [x.type, x.value]));
  return { date: `${p.year}-${p.month}-${p.day}`, hour: Number(p.hour) };
}

/** Should a scheduled trigger at `now` run? Yes from RUN_HOUR on, unless a scheduled run already happened that local day. */
export function isMorningSlot(now: number, lastScheduledRun?: number): boolean {
  const here = localParts(now);
  if (here.hour < RUN_HOUR) return false;
  return !lastScheduledRun || localParts(lastScheduledRun).date !== here.date;
}

/** The next scheduled run after `now` (approximate: GitHub can start it some minutes late). */
export function nextRun(now: number): number {
  const d = new Date(now);
  for (let day = 0; day <= 2; day++) {
    for (const [h, m] of CRON_UTC) {
      const t = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() + day, h, m);
      if (t > now && localParts(t).hour === RUN_HOUR) return t;
    }
  }
  return now + 24 * 3600_000;
}
