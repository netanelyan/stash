// Inline SVG only. Nothing is fetched, no icon font, no icon package.
const base = { width: 14, height: 14, viewBox: '0 0 16 16', fill: 'none', stroke: 'currentColor', strokeWidth: 1.4, strokeLinecap: 'round', strokeLinejoin: 'round' };

export const IconMenu = (p) => (
  <svg {...base} {...p}><path d="M2.5 4h11M2.5 8h11M2.5 12h11" /></svg>
);
export const IconPlus = (p) => (
  <svg {...base} {...p}><path d="M8 3v10M3 8h10" /></svg>
);
export const IconFolderPlus = (p) => (
  <svg {...base} {...p}><path d="M1.5 12.5v-9h4l1.5 2h7.5v7z" /><path d="M8 7.5v3M6.5 9h3" /></svg>
);
export const IconGear = (p) => (
  <svg {...base} {...p}><circle cx="8" cy="8" r="2.2" /><path d="M8 1.5v1.6M8 12.9v1.6M14.5 8h-1.6M3.1 8H1.5M12.6 3.4l-1.1 1.1M4.5 11.5l-1.1 1.1M12.6 12.6l-1.1-1.1M4.5 4.5L3.4 3.4" /></svg>
);
export const IconPanel = (p) => (
  <svg {...base} {...p}><rect x="1.5" y="2.5" width="13" height="11" rx="1" /><path d="M10 2.5v11" /></svg>
);
export const IconChevron = (p) => (
  <svg {...base} width="10" height="10" viewBox="0 0 16 16" {...p}><path d="M6 3l5 5-5 5" /></svg>
);
export const IconFile = (p) => (
  <svg {...base} {...p}><path d="M9 1.5H4.5A1 1 0 003.5 2.5v11a1 1 0 001 1h7a1 1 0 001-1V5.5z" /><path d="M9 1.5v4h3.5" /></svg>
);
export const IconMin = () => (
  <svg width="10" height="10" viewBox="0 0 10 10"><rect x="0" y="4.5" width="10" height="1" fill="currentColor" /></svg>
);
export const IconMax = ({ maximized }) => (
  maximized ? (
    <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1">
      <rect x="0.5" y="2.5" width="7" height="7" /><path d="M2.5 2.5v-2h7v7h-2" />
    </svg>
  ) : (
    <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1">
      <rect x="0.5" y="0.5" width="9" height="9" />
    </svg>
  )
);
export const IconClose = () => (
  <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.1">
    <path d="M0.5 0.5l9 9M9.5 0.5l-9 9" />
  </svg>
);
