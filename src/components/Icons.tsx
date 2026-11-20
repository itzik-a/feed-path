/* Small stroke icons, 24px grid, drawn in currentColor. */
import type { SVGProps } from "react";

type P = SVGProps<SVGSVGElement>;
const base = (p: P) => ({
  width: 22, height: 22, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor",
  strokeWidth: 1.8, strokeLinecap: "round" as const, strokeLinejoin: "round" as const,
  "aria-hidden": true, ...p,
});

export const IconFeed = (p: P) => (
  <svg {...base(p)}><rect x="4" y="4" width="16" height="16" rx="3" /><path d="M8 9h8M8 12.5h8M8 16h5" /></svg>
);
export const IconSaved = (p: P) => (
  <svg {...base(p)}><path d="M7 4h10a1 1 0 0 1 1 1v15l-6-4-6 4V5a1 1 0 0 1 1-1Z" /></svg>
);
export const IconSavedFill = (p: P) => (
  <svg {...base({ fill: "currentColor", ...p })}><path d="M7 4h10a1 1 0 0 1 1 1v15l-6-4-6 4V5a1 1 0 0 1 1-1Z" /></svg>
);
export const IconSources = (p: P) => (
  <svg {...base(p)}><circle cx="6" cy="18" r="1.6" fill="currentColor" /><path d="M5 11a8 8 0 0 1 8 8M5 5a14 14 0 0 1 14 14" /></svg>
);
export const IconTopics = (p: P) => (
  <svg {...base(p)}><path d="M9 4 7 20M17 4l-2 16M4.5 9h16M3.5 15h16" /></svg>
);
export const IconSearch = (p: P) => (
  <svg {...base({ width: 18, height: 18, ...p })}><circle cx="11" cy="11" r="6.5" /><path d="M20 20l-4.2-4.2" /></svg>
);
export const IconClose = (p: P) => (
  <svg {...base({ width: 16, height: 16, strokeWidth: 2.2, ...p })}><path d="M6 6l12 12M18 6L6 18" /></svg>
);
export const IconBack = (p: P) => (
  <svg {...base({ width: 20, height: 20, strokeWidth: 2.2, ...p })}><path d="M15 5l-7 7 7 7" /></svg>
);
export const IconChevronDown = (p: P) => (
  <svg {...base({ width: 16, height: 16, strokeWidth: 2.2, ...p })}><path d="M6 9l6 6 6-6" /></svg>
);
export const IconPlus = (p: P) => (
  <svg {...base({ width: 18, height: 18, strokeWidth: 2.2, ...p })}><path d="M12 5v14M5 12h14" /></svg>
);
export const IconExternal = (p: P) => (
  <svg {...base({ width: 14, height: 14, strokeWidth: 2, ...p })}><path d="M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5" /></svg>
);
export const IconUp = (p: P) => (
  <svg {...base({ width: 18, height: 18, ...p })}><path d="M7 11v9H4.5a1 1 0 0 1-1-1v-7a1 1 0 0 1 1-1H7Zm0 0 4-7a2 2 0 0 1 2 2v4h5.2a2 2 0 0 1 2 2.4l-1.2 6A2 2 0 0 1 17 20H7" /></svg>
);
export const IconDown = (p: P) => (
  <svg {...base({ width: 18, height: 18, ...p })}><path d="M17 13V4h2.5a1 1 0 0 1 1 1v7a1 1 0 0 1-1 1H17Zm0 0-4 7a2 2 0 0 1-2-2v-4H5.8a2 2 0 0 1-2-2.4l1.2-6A2 2 0 0 1 7 4h10" /></svg>
);
export const IconVideo = (p: P) => (
  <svg {...base({ width: 14, height: 14, ...p })}><rect x="3" y="6" width="13" height="12" rx="2" /><path d="M16 10.5 21 8v8l-5-2.5" /></svg>
);
export const IconLink = (p: P) => (
  <svg {...base({ width: 18, height: 18, ...p })}><path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1" /></svg>
);
export const IconCheck = (p: P) => (
  <svg {...base({ width: 14, height: 14, strokeWidth: 2.6, ...p })}><path d="M5 12.5l4.5 4.5L19 7.5" /></svg>
);
export const IconMinus = (p: P) => (
  <svg {...base({ width: 18, height: 18, strokeWidth: 2.2, ...p })}><path d="M5 12h14" /></svg>
);
