import type { ModuleId } from '../../state/params';

const PATHS = {
  power: 'M12 3v8M6.3 6.3a8 8 0 1 0 11.4 0',
  mic: 'M12 3a3 3 0 0 0-3 3v6a3 3 0 0 0 6 0V6a3 3 0 0 0-3-3zM5 11a7 7 0 0 0 14 0M12 18v3',
  headphones: 'M4 15v-3a8 8 0 0 1 16 0v3M4 15a2 2 0 0 1 2-2h1v7H6a2 2 0 0 1-2-2zM20 15a2 2 0 0 0-2-2h-1v7h1a2 2 0 0 0 2-2z',
  plug: 'M9 2v5M15 2v5M6 7h12v4a6 6 0 0 1-12 0zM12 17v5',
  keyboard: 'M3 6h18v12H3zM7 10h.01M11 10h.01M15 10h.01M7 14h10',
  sun: 'M12 4V2M12 22v-2M4 12H2M22 12h-2M5.6 5.6 4.2 4.2M19.8 19.8l-1.4-1.4M5.6 18.4l-1.4 1.4M19.8 4.2l-1.4 1.4M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8z',
  moon: 'M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z',
  search: 'M11 4a7 7 0 1 0 0 14 7 7 0 0 0 0-14zM20 20l-4-4',
  star: 'M12 3l2.8 5.8 6.2.9-4.5 4.4 1 6.2L12 17.4l-5.5 2.9 1-6.2L3 9.7l6.2-.9z',
  dots: 'M5 12h.01M12 12h.01M19 12h.01',
  close: 'M6 6l12 12M18 6 6 18',
  chevron: 'M9 6l6 6-6 6',
  reset: 'M4 4v6h6M4.6 15a8 8 0 1 0 1.8-8.4L4 10',
  download: 'M12 3v12M7 10l5 5 5-5M4 19h16',
  upload: 'M12 21V9M7 14l5-5 5 5M4 5h16',
  trash: 'M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13',
  save: 'M5 3h11l3 3v15H5zM8 3v5h7V3M8 21v-7h8v7',
  refresh: 'M20 11a8 8 0 0 0-14.8-3.5L4 9M4 4v5h5M4 13a8 8 0 0 0 14.8 3.5L20 15M20 20v-5h-5',
  volume: 'M4 9v6h4l5 4V5L8 9zM16 9a4 4 0 0 1 0 6M18.5 6.5a8 8 0 0 1 0 11',
  mute: 'M4 9v6h4l5 4V5L8 9zM17 9l5 6M22 9l-5 6',
  ab: 'M4 18 8 6l4 12M5.5 14h5M14 6h4a3 3 0 0 1 0 6h-4zM14 12h4.5a3 3 0 0 1 0 6H14z',
  sliders: 'M4 6h10M18 6h2M4 12h4M12 12h8M4 18h12M20 18h0M14 4v4M8 10v4M16 16v4',
  music: 'M9 18V5l11-2v13M9 18a3 3 0 1 1-6 0 3 3 0 0 1 6 0zM20 16a3 3 0 1 1-6 0 3 3 0 0 1 6 0z',
  grid: 'M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4zM13 13h7v7h-7z',
  record: 'M12 7a5 5 0 1 0 0 10 5 5 0 0 0 0-10z',
  play: 'M7 4v16l13-8z',
  stop: 'M6 6h12v12H6z',
  info: 'M12 8h.01M11 12h1v5h1M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18z',
  check: 'M5 12l5 5L20 7',
  copy: 'M8 8h12v12H8zM4 16V4h12',
  wave: 'M2 12h2l2-6 3 12 3-14 3 16 3-10 2 4h2',
  plus: 'M12 5v14M5 12h14',
  edit: 'M4 20h4L20 8l-4-4L4 16zM14 6l4 4',
} as const;

const MODULE_PATHS: Record<ModuleId, string> = {
  gate: 'M3 12h4V6h4v12h4V9h6',
  pitch: 'M8 4v16M4 8l4-4 4 4M16 20V4M12 16l4 4 4-4',
  autotune: 'M9 18V5l10-2v12M9 18a3 3 0 1 1-6 0 3 3 0 0 1 6 0zM19 15a3 3 0 1 1-6 0 3 3 0 0 1 6 0z',
  harmonizer: 'M4 8c3-4 5 4 8 0s5 4 8 0M4 13c3-4 5 4 8 0s5 4 8 0M4 18c3-4 5 4 8 0s5 4 8 0',
  ringmod: 'M12 4a8 8 0 1 0 0 16 8 8 0 0 0 0-16zM6 12c2-4 4 4 6 0s4 4 6 0',
  vocoder: 'M4 16v-4M8 18V8M12 20V4M16 17V9M20 14v-2',
  distortion: 'M3 12h3l3-7 3 14 3-14 3 7h3',
  bitcrusher: 'M3 18h4v-4h4v-4h4V6h6',
  filter: 'M3 8h7c4 0 4 10 11 10',
  eq: 'M6 4v16M12 4v16M18 4v16M4 14h4M10 8h4M16 12h4',
  compressor: 'M4 4l6 6M20 4l-6 6M4 20l6-6M20 20l-6-6M9 12h6',
  modulation: 'M2 12c2.5-6 5.5-6 8 0s5.5 6 8 0 2-3 4-3',
  delay: 'M4 12h2M9 12h2M14 12h2M19 12h1M6 8v8M11 9v6M16 10v4',
  reverb: 'M4 12a8 8 0 0 1 8-8M7 12a5 5 0 0 1 5-5M10 12a2 2 0 0 1 2-2M12 20a8 8 0 0 0 8-8',
  noise: 'M4 6h.01M9 4h.01M14 7h.01M19 5h.01M6 11h.01M11 13h.01M17 11h.01M4 17h.01M9 19h.01M14 16h.01M19 18h.01',
};

export type IconName = keyof typeof PATHS;

export function Icon({ name, size = 18, className }: { name: IconName; size?: number; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <path d={PATHS[name]} />
    </svg>
  );
}

export function ModuleIcon({ id, size = 16 }: { id: ModuleId; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={MODULE_PATHS[id]} />
    </svg>
  );
}

export function BrandMark({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" aria-hidden="true">
      <path d="M3 12h1.5M7 8v8M10.5 4v16M14 7v10M17.5 10v4M21 12h0" />
    </svg>
  );
}
