import { useEffect, useState, type ComponentType, type SVGProps } from "react";
import { IconFeed, IconSaved, IconSources, IconTopics } from "./components/Icons";
import { SyncPill, SyncSheet } from "./components/SyncSheet";
import { Toast } from "./components/Toast";
import { Feed } from "./views/Feed";
import { Saved } from "./views/Saved";
import { Sources } from "./views/Sources";
import { Topics } from "./views/Topics";

export type View = "feed" | "saved" | "sources" | "topics";
const TABS: { id: View; label: string; Icon: ComponentType<SVGProps<SVGSVGElement>> }[] = [
  { id: "feed", label: "Feed", Icon: IconFeed },
  { id: "saved", label: "Saved", Icon: IconSaved },
  { id: "sources", label: "Sources", Icon: IconSources },
  { id: "topics", label: "Topics", Icon: IconTopics },
];

/** "#feed/filtered" → { view: "feed", sub: "filtered" } */
interface Route { view: View; sub?: string }

const readHash = (): Route => {
  const [v, ...rest] = decodeURIComponent(location.hash.slice(1)).split("/");
  const view = TABS.some((t) => t.id === v) ? (v as View) : "feed";
  return { view, sub: rest.join("/") || undefined };
};

export function App() {
  const [route, setRoute] = useState<Route>(readHash);
  const [syncOpen, setSyncOpen] = useState(false);

  useEffect(() => {
    const on = () => setRoute((prev) => {
      const next = readHash();
      if (next.view !== prev.view || next.sub !== prev.sub) window.scrollTo(0, 0);
      return next;
    });
    window.addEventListener("hashchange", on);
    return () => window.removeEventListener("hashchange", on);
  }, []);

  const { view } = route;
  const openSync = () => setSyncOpen(true);

  return (
    <div className="shell">
      <aside className="sidebar">
        <a className="brand" href="#feed" aria-label="Feed Path, feed">
          <img src="./icon.svg" alt="" width={30} height={30} />
          <span>Feed Path</span>
        </a>
        <nav className="side-nav" aria-label="Sections">
          {TABS.map(({ id, label, Icon }) => (
            <a key={id} href={`#${id}`} aria-current={view === id ? "page" : undefined}><Icon /><span>{label}</span></a>
          ))}
        </nav>
        <div className="side-foot"><SyncPill onOpen={openSync} /></div>
      </aside>

      <header className="topbar">
        <a className="brand" href="#feed" aria-label="Feed Path, feed">
          <img src="./icon.svg" alt="" width={28} height={28} />
          <span>Feed Path</span>
        </a>
        <SyncPill onOpen={openSync} />
      </header>

      <main className={`main view-${view}`} key={`${view}/${route.sub ?? ""}`}>
        {view === "feed" ? <Feed sub={route.sub} onOpenSync={openSync} />
          : view === "saved" ? <Saved />
          : view === "sources" ? <Sources />
          : <Topics />}
      </main>

      <Toast />
      {syncOpen && <SyncSheet onClose={() => setSyncOpen(false)} />}

      <nav className="tabbar" aria-label="Sections">
        {TABS.map(({ id, label, Icon }) => (
          <a key={id} href={`#${id}`} aria-current={view === id ? "page" : undefined}><Icon /><span>{label}</span></a>
        ))}
      </nav>
    </div>
  );
}
