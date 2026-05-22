/**
 * SVG Icon library — replaces all emoji with hand-drawn SVG icons.
 * Usage: icons.get('train') returns an inline SVG string.
 */

const _svgs = {
  // Header buttons
  help: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M9 9a3 3 0 015.12-2.13A3 3 0 0112 14v1"/><circle cx="12" cy="19" r="0.5" fill="currentColor"/></svg>`,
  save: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M19 21H5a2 2 0 01-2-2V5a2 2 0 012-2h11l5 5v11a2 2 0 01-2 2z"/><path d="M17 21v-8H7v8M7 3v5h8"/></svg>`,
  folder: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z"/></svg>`,

  // Map toggles
  satellite: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="3"/><path d="M6.3 6.3l-1.4-1.4M17.7 6.3l1.4-1.4M6.3 17.7l-1.4 1.4M17.7 17.7l1.4 1.4"/><path d="M3 12h2M19 12h2M12 3v2M12 19v2"/></svg>`,
  radar: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 12l4-8"/><circle cx="12" cy="12" r="2"/><path d="M4.9 19.1A10 10 0 0112 2a10 10 0 017.1 17.1"/><path d="M7.8 16.2A6 6 0 0112 6a6 6 0 014.2 10.2"/></svg>`,

  // Weather
  sun: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="5"/><path d="M12 1v2M12 21v2M4.2 4.2l1.4 1.4M18.4 18.4l1.4 1.4M1 12h2M21 12h2M4.2 19.8l1.4-1.4M18.4 5.6l1.4-1.4"/></svg>`,
  rain: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M16 13a4 4 0 01.9 7.9H6a3 3 0 01-.4-6A5 5 0 0116 13z"/><path d="M8 19v2M12 19v2M16 19v2"/></svg>`,
  snow: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2v20M2 12h20M4.9 4.9l14.2 14.2M19.1 4.9L4.9 19.1"/><circle cx="12" cy="12" r="2"/></svg>`,
  storm: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M19 16.9A5 5 0 0018 7h-1.3A8 8 0 103 15.3"/><path d="M13 11l-4 6h6l-4 6"/></svg>`,
  thermometer: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 14.76V3.5a2.5 2.5 0 00-5 0v11.26a4.5 4.5 0 105 0z"/></svg>`,
  fog: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 8h16M4 12h16M4 16h12M6 20h8"/></svg>`,
  wind: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9.6 4.5A2.5 2.5 0 0114 6H2M12.9 7.5A2.5 2.5 0 0117 9H2M16.7 17.5A2.5 2.5 0 0014 15H2"/></svg>`,
  droplet: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2.7c-.8 1-6 6.6-6 10.3a6 6 0 0012 0c0-3.7-5.2-9.3-6-10.3z"/></svg>`,
  cloud: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 10a4 4 0 01.9 7.9H6a3 3 0 01-.4-6A5 5 0 0118 10z"/></svg>`,
  signal: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M2 20h.01M7 20v-4M12 20v-8M17 20V12M22 20V4"/></svg>`,
  gauge: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M12 6v2M6 12h2M16.2 7.8l-4.6 4.6"/><circle cx="12" cy="12" r="1" fill="currentColor"/></svg>`,
  eye: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8S1 12 1 12z"/><circle cx="12" cy="12" r="3"/></svg>`,

  // Game
  train: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="4" y="3" width="16" height="14" rx="2"/><path d="M4 11h16M9 21l-2-4M15 21l2-4"/><circle cx="9" cy="7" r="1" fill="currentColor"/><circle cx="15" cy="7" r="1" fill="currentColor"/></svg>`,
  station: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 21h18M5 21V7l7-4 7 4v14"/><path d="M9 21v-4h6v4M9 9h1M14 9h1M9 13h1M14 13h1"/></svg>`,
  track: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 3v18M18 3v18M6 6h12M6 12h12M6 18h12"/></svg>`,
  cargo: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 16V8a2 2 0 00-1-1.7l-7-4a2 2 0 00-2 0l-7 4A2 2 0 003 8v8a2 2 0 001 1.7l7 4a2 2 0 002 0l7-4A2 2 0 0021 16z"/><path d="M3.3 7L12 12l8.7-5M12 22V12"/></svg>`,
  money: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 1v22M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6"/></svg>`,
  wrench: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14.7 6.3a1 1 0 000 1.4l1.6 1.6a1 1 0 001.4 0l3.8-3.8a6 6 0 01-8.5 8.5L5.3 21.7a2.1 2.1 0 01-3-3L10 11a6 6 0 018.5-8.5l-3.8 3.8z"/></svg>`,
  warning: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10.3 3.9L1.7 18.4A2 2 0 003.4 21h17.2a2 2 0 001.7-2.6L13.7 3.9a2 2 0 00-3.4 0z"/><path d="M12 9v4M12 17h.01"/></svg>`,
  people: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.9M16 3.1a4 4 0 010 7.8"/></svg>`,
  bank: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 21h18M3 10h18M12 3l9 7H3l9-7z"/><path d="M5 10v8M9 10v8M15 10v8M19 10v8"/></svg>`,
  weather: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 10a4 4 0 01.9 7.9H6a3 3 0 01-.4-6A5 5 0 0118 10z"/><path d="M22 6l-1.5 1.5M18 2v2M13.5 3.5L12 5"/></svg>`,
  shield: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>`,
  calendar: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/></svg>`,
  transfer: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M7 16V4m0 0L3 8m4-4l4 4M17 8v12m0 0l4-4m-4 4l-4-4"/></svg>`,
  upgrade: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 21h18M9 21V8h6v13M6 21V12h3M15 21V12h3M10 4l2-2 2 2"/></svg>`,
  junction: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 3v18M18 3v12"/><path d="M6 12c4 0 8-4 12-4"/></svg>`,
  factory: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M2 20h20M4 20V8l6 4V8l6 4V4h4v16"/><path d="M8 16h.01M14 16h.01"/></svg>`,
  oil: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 22V6c0-1.1.9-2 2-2h8a2 2 0 012 2v16"/><path d="M6 12h12M10 12v4M14 12v4"/></svg>`,
  chemistry: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 3h6M10 3v6l-5 8.5a2 2 0 001.7 3h10.6a2 2 0 001.7-3L14 9V3"/></svg>`,
  lightning: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/></svg>`,
  lock: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0110 0v4"/></svg>`,
  parking: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M9 17V7h4a3 3 0 010 6H9"/></svg>`,
  hall: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 21h18M4 21V10l8-7 8 7v11"/><path d="M10 21v-6h4v6"/></svg>`,
  restaurant: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 8h1a4 4 0 010 8h-1M2 8h16v9a4 4 0 01-4 4H6a4 4 0 01-4-4V8z"/><path d="M6 1v3M10 1v3M14 1v3"/></svg>`,
  dashboard: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg>`,
  chart: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 3v18h18"/><path d="M7 14l4-4 4 4 5-5"/></svg>`,
  sorting: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h18M3 12h12M3 18h6"/></svg>`,
  wifi: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M2 8.8A17 17 0 0122 8.8M5 12.8a12 12 0 0114 0M8.5 16.8a7 7 0 017 0"/><circle cx="12" cy="20" r="1" fill="currentColor"/></svg>`,
  scale: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 3v18M5 8l7-5 7 5"/><path d="M3 13l2-5 2 5a4 4 0 01-4 0zM17 13l2-5 2 5a4 4 0 01-4 0z"/></svg>`,
  container: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="6" width="20" height="12" rx="1"/><path d="M7 6v12M12 6v12M17 6v12"/></svg>`,
  hazard: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M12 8v4M12 16h.01"/></svg>`,
  crane: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 21V3h3v18M6 6h14M20 6v6M17 12h6M20 12v3"/></svg>`,
  silo: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 21V9a6 6 0 0112 0v12"/><path d="M6 14h12M6 18h12"/></svg>`,
  warehouse: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 21h18M3 10l9-7 9 7"/><rect x="7" y="14" width="10" height="7"/><path d="M10 21v-4h4v4"/></svg>`,

  // Status dots
  dot_green: `<svg viewBox="0 0 12 12"><circle cx="6" cy="6" r="5" fill="#22c55e"/></svg>`,
  dot_yellow: `<svg viewBox="0 0 12 12"><circle cx="6" cy="6" r="5" fill="#eab308"/></svg>`,
  dot_red: `<svg viewBox="0 0 12 12"><circle cx="6" cy="6" r="5" fill="#ef4444"/></svg>`,
  dot_blue: `<svg viewBox="0 0 12 12"><circle cx="6" cy="6" r="5" fill="#3b82f6"/></svg>`,
  dot_gray: `<svg viewBox="0 0 12 12"><circle cx="6" cy="6" r="5" fill="#94a3b8"/></svg>`,

  // Map legend
  map: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 6v16l7-4 8 4 7-4V2l-7 4-8-4-7 4z"/><path d="M8 2v16M16 6v16"/></svg>`,
  info: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4M12 8h.01"/></svg>`,
  screen: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8M12 17v4"/></svg>`,
  book: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 19.5A2.5 2.5 0 016.5 17H20V3H6.5A2.5 2.5 0 004 5.5v14z"/><path d="M4 19.5A2.5 2.5 0 016.5 17H20"/></svg>`,

  // Shunting
  shunting: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M16 3l4 4-4 4"/><path d="M20 7H4M8 21l-4-4 4-4"/><path d="M4 17h16"/></svg>`,

  // Automobile
  car: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M5 17h14M7 17l1-5h8l1 5"/><circle cx="7.5" cy="17" r="1.5"/><circle cx="16.5" cy="17" r="1.5"/><path d="M5 12l2-5h10l2 5"/></svg>`,

  // Wood/timber
  wood: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="3"/><path d="M12 3v6M12 15v6M3 12h6M15 12h6"/></svg>`,
};

export function icon(name, size = 16, cls = '') {
  const svg = _svgs[name];
  if (!svg) return `<span style="width:${size}px;display:inline-block">&nbsp;</span>`;
  return `<span class="icon ${cls}" style="display:inline-flex;width:${size}px;height:${size}px;vertical-align:middle">${svg}</span>`;
}

export function iconSvg(name) {
  return _svgs[name] || '';
}

export default { icon, iconSvg };
