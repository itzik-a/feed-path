import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";
import { setFeed } from "./state/feed";
import { startSync } from "./state/sync";
import "./lib/theme";
import "./styles.css";

startSync();

// Dev only: http://localhost:5173/?demo loads the feed from the last local collector run (npm run collect:dry).
if (import.meta.env.DEV && new URLSearchParams(location.search).has("demo")) {
  fetch("/collector/out/feed.json").then((r) => r.text()).then(setFeed).catch(() => {});
}

// Offline launch from the Home Screen. Production only, so dev reloads stay fresh.
if (import.meta.env.PROD && "serviceWorker" in navigator) {
  window.addEventListener("load", () => { navigator.serviceWorker.register("./sw.js").catch(() => {}); });
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
