/* "Sync & collector": connect this device to the gist, see sync status, the collector's last runs, and settings. */
import { useEffect, useRef, useState, type FormEvent } from "react";
import { setKeepDays } from "../state/actions";
import { useFeed } from "../state/feed";
import { useAppState } from "../state/store";
import { TOKEN_URL, connect, disconnect, syncNow, useSyncStatus, type SyncStatus } from "../state/sync";
import { ago, clock } from "../lib/time";
import { IconExternal } from "./Icons";
import { ThemePicker } from "./ThemePicker";
import { backdropClose } from "../lib/backdrop";

export const REPO = "https://github.com/itzik-a/feed-path";
export const RUN_URL = `${REPO}/actions/workflows/collect.yml`;

const dotClass = (s: SyncStatus) => (s.kind === "ok" ? "ok" : s.kind === "busy" ? "busy" : s.kind === "pending" ? "pending" : s.kind === "error" ? "err" : "");

export function SyncPill({ onOpen }: { onOpen: () => void }) {
  const s = useSyncStatus();
  return (
    <button type="button" className="sync" onClick={onOpen} aria-label={`Sync: ${s.text}. Open sync and collector`}>
      <span className={`dot ${dotClass(s)}`} />
      <span role="status">{s.text}</span>
    </button>
  );
}

export function SyncSheet({ onClose }: { onClose: () => void }) {
  const s = useSyncStatus();
  const feed = useFeed();
  const app = useAppState();
  const [token, setToken] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const ref = useRef<HTMLDialogElement>(null);
  const [, tick] = useState(0);

  useEffect(() => {
    ref.current?.showModal();
    const iv = setInterval(() => tick((n) => n + 1), 10_000); // keep "x min ago" fresh
    return () => clearInterval(iv);
  }, []);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!token.trim()) return;
    setBusy(true); setErr("");
    try { await connect(token); setToken(""); }
    catch (x) { setErr((x as Error).message); }
    finally { setBusy(false); }
  }

  const connected = s.kind !== "off";
  const run = feed.runs[0];
  const tokens = feed.runs.slice(0, 12).reduce((a, r) => ({ in: a.in + (r.tokens?.in ?? 0), out: a.out + (r.tokens?.out ?? 0) }), { in: 0, out: 0 });
  const cost = (tokens.in * 0.1 + tokens.out * 0.5) / 1_000_000;

  return (
    <dialog ref={ref} className="dlg" aria-labelledby="dlg-title" onClose={onClose} {...backdropClose(ref)}>
      <div className="dlg-body">
        <div className="dlg-grip" aria-hidden="true" />
        <div className="card-head">
          <h2 id="dlg-title">Sync &amp; collector</h2>
          <button type="button" className="btn ghost sm" onClick={() => ref.current?.close()}>Done</button>
        </div>

        <section className="dlg-section" aria-labelledby="sync-title">
          <h3 id="sync-title">This device</h3>
          {connected ? (
            <>
              <div className="sync-state">
                <span className={`dot ${dotClass(s)}`} />
                <div>
                  <b>{s.text}</b>
                  <span className="muted small">Last synced {s.last ? ago(s.last) : "not yet"}</span>
                </div>
              </div>
              {s.detail && (s.kind === "error" || s.kind === "offline") && <p className="small">{s.detail}</p>}
              <p className="muted small">
                Your sources, topics, links and what you've read or saved are kept in a private gist on your GitHub account,
                next to the feed the collector writes there. The app checks for a new feed every 2 minutes while it's open.
              </p>
              <div className="dlg-actions">
                <button type="button" className="btn primary" disabled={s.kind === "busy"} onClick={() => void syncNow(true)}>Sync now</button>
                {s.gistId && <a className="btn ghost" href={`https://gist.github.com/${s.gistId}`} target="_blank" rel="noopener">View the gist <IconExternal /></a>}
                <button type="button" className="btn ghost danger" onClick={() => { if (window.confirm("Stop syncing on this device? Everything stays in the gist.")) disconnect(); }}>
                  Disconnect this device
                </button>
              </div>
            </>
          ) : (
            <>
              <p className="muted small">
                The feed is written to a private gist by the collector, so connect each device once with a GitHub token to see it.
              </p>
              <ol className="steps">
                <li>
                  <b>Create a token on GitHub</b>
                  <span className="muted small">
                    The link opens the form with only the <code>gist</code> permission ticked. Choose an expiration, press
                    <i> Generate token</i>, and copy it. The token you made for Workout Path or Piano Path works too.
                    Use the same token on every device and as the collector's <code>GIST_TOKEN</code>.
                  </span>
                  <a className="link" href={TOKEN_URL} target="_blank" rel="noopener">Open GitHub token page <IconExternal /></a>
                </li>
                <li>
                  <b>Paste it here</b>
                  <form className="token-form" onSubmit={submit}>
                    <input
                      type="password" autoComplete="off" autoCapitalize="off" spellCheck={false}
                      placeholder="ghp_…" aria-label="GitHub token" value={token} onChange={(e) => setToken(e.target.value)}
                    />
                    <button className="btn primary" type="submit" disabled={busy || !token.trim()}>{busy ? "Connecting…" : "Connect"}</button>
                  </form>
                  {err && <p className="form-error" role="alert">{err}</p>}
                </li>
              </ol>
              <p className="muted small">The token stays on this device and can do nothing except read and write your gists.</p>
            </>
          )}
        </section>

        <section className="dlg-section" aria-labelledby="col-title">
          <h3 id="col-title">Collector</h3>
          {run ? (
            <>
              <div className="sync-state">
                <span className={`dot ${run.errors.length ? "err" : "ok"}`} />
                <div>
                  <b>Last run {ago(run.at)} ({clock(run.at)})</b>
                  <span className="muted small">
                    {run.added} new · {run.merged} added to existing stories · {run.dropped} filtered out
                    {run.errors.length ? ` · ${run.errors.length} ${run.errors.length === 1 ? "problem" : "problems"}` : ""}
                  </span>
                </div>
              </div>
              {feed.lastRead && feed.lastRead > run.at && (
                <p className="muted small">
                  Sources last read {ago(feed.lastRead)}{feed.waiting ? `: ${feed.waiting} new ${feed.waiting === 1 ? "item" : "items"} saved for the morning run` : ""}.
                  They're read every 3 hours; Claude goes through everything once a day, around 09:30.
                </p>
              )}
              {Date.now() - run.at > 30 * 3600_000 && (
                <p className="small">No run for a while. GitHub may have paused the schedule; open the Actions page to check.</p>
              )}
              {run.errors.length > 0 && (
                <details className="errs">
                  <summary className="small">What went wrong</summary>
                  <ul className="small">{run.errors.map((e, i) => <li key={i}>{e}</li>)}</ul>
                </details>
              )}
              {tokens.in > 0 && (
                <p className="muted small">
                  Last {Math.min(12, feed.runs.length)} runs: {tokens.in.toLocaleString()} tokens in, {tokens.out.toLocaleString()} out
                  {" "}≈ ${cost.toFixed(3)} with Claude Haiku 5.5.
                </p>
              )}
            </>
          ) : (
            <p className="muted small">
              {connected ? "No run yet. The collector runs on GitHub every morning around 09:30; you can start one by hand." : "Connect to see the collector's runs."}
            </p>
          )}
          <div className="dlg-actions">
            <a className="btn ghost" href={RUN_URL} target="_blank" rel="noopener">Runs on GitHub <IconExternal /></a>
          </div>
          <p className="muted small">To run it now: on that page press <i>Run workflow</i>. It takes a minute or two.</p>
        </section>

        <section className="dlg-section" aria-labelledby="set-title">
          <h3 id="set-title">Settings</h3>
          <div className="field">
            <span className="small" id="keep-label">Keep entries in the feed for</span>
            <div className="seg" role="group" aria-labelledby="keep-label">
              {[5, 10, 14, 21].map((n) => (
                <button key={n} type="button" aria-pressed={app.settings.keepDays === n} onClick={() => setKeepDays(n)}>{n} days</button>
              ))}
            </div>
          </div>
          <p className="muted small">Saved entries are kept for good, whatever this says.</p>
        </section>
        <section className="dlg-section" aria-labelledby="theme-title">
          <h3 id="theme-title">Appearance</h3>
          <ThemePicker />
          <p className="muted small">System follows this device's light or dark setting. Each device keeps its own choice.</p>
        </section>
      </div>
    </dialog>
  );
}
