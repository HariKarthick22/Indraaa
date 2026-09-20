/**
 * Spec §3.6: the Appearance panel edits a `Theme` and applies it live — no
 * restart, no theme store. A theme is also a text blob under 1 kB, so a plant
 * can hand-carry a house theme as a pasted string with no network involved.
 */

export const THEME_BASES = ['dark', 'light', 'high-contrast', 'oled'] as const;
export type ThemeBase = (typeof THEME_BASES)[number];

export const THEME_SCALES = [0.9, 1, 1.1, 1.25] as const;
export type ThemeScale = (typeof THEME_SCALES)[number];

export const THEME_DENSITIES = ['compact', 'comfortable'] as const;
export type ThemeDensity = (typeof THEME_DENSITIES)[number];

export const THEME_MOTIONS = ['full', 'reduced', 'none'] as const;
export type ThemeMotion = (typeof THEME_MOTIONS)[number];

export const THEME_STREAMS = ['calm', 'normal', 'instant'] as const;
export type ThemeStream = (typeof THEME_STREAMS)[number];

// Mirrors Task 25b's `TraceDensity`. Declared again here rather than imported
// so this module has no dependency on the lock-overlay/trace-density module —
// both are plain string-literal unions and stay structurally interchangeable.
export const THEME_TRACE_DENSITIES = ['quiet', 'normal', 'trace'] as const;
export type ThemeTraceDensity = (typeof THEME_TRACE_DENSITIES)[number];

export interface ThemeFont {
  ui: string;
  mono: string;
  scale: ThemeScale;
  ligatures: boolean;
}

export interface Theme {
  name: string;
  base: ThemeBase;
  font: ThemeFont;
  density: ThemeDensity;
  motion: ThemeMotion;
  stream: ThemeStream;
  trace: ThemeTraceDensity;
  /** House overrides, keyed by CSS custom property. Wins over everything the base sets. */
  overrides: Record<string, string>;
}

export const DEFAULT_THEME: Theme = {
  name: 'Ash Dark',
  base: 'dark',
  font: { ui: 'Geist Sans', mono: 'Geist Mono', scale: 1, ligatures: false },
  density: 'compact',
  motion: 'full',
  stream: 'normal',
  trace: 'normal',
  overrides: {},
};

/** A theme must fit in a text field a person can paste into (spec §3.6). */
export const THEME_BLOB_LIMIT = 1024;

export function themeByteLength(blob: string): number {
  return new TextEncoder().encode(blob).length;
}

export function serialiseTheme(theme: Theme): string {
  return JSON.stringify(theme);
}

function joinWithOr(items: readonly string[]): string {
  if (items.length <= 1) return items.join('');
  return `${items.slice(0, -1).join(', ')} or ${items[items.length - 1]}`;
}

function isThemeBase(value: unknown): value is ThemeBase {
  return (THEME_BASES as readonly unknown[]).includes(value);
}

function isThemeScale(value: unknown): value is ThemeScale {
  return (THEME_SCALES as readonly unknown[]).includes(value);
}

export type ParseThemeResult = { ok: true; theme: Theme } | { ok: false; error: string };

/**
 * Parses a pasted theme blob. Unknown top-level fields are ignored and
 * missing ones fall back to `DEFAULT_THEME`, so a house theme only needs to
 * state what it changes — matching the shape the spec prints as an example.
 */
export function parseTheme(blob: string): ParseThemeResult {
  if (themeByteLength(blob) > THEME_BLOB_LIMIT) {
    return { ok: false, error: `Theme text must be under ${THEME_BLOB_LIMIT} bytes.` };
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(blob);
  } catch {
    return { ok: false, error: 'Theme text is not valid JSON.' };
  }

  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    return { ok: false, error: 'Theme text is not valid JSON.' };
  }

  const value = parsed as Record<string, unknown>;

  if (value.base !== undefined && !isThemeBase(value.base)) {
    return { ok: false, error: `Base must be ${joinWithOr(THEME_BASES)}.` };
  }

  const font = (typeof value.font === 'object' && value.font !== null ? value.font : {}) as Record<
    string,
    unknown
  >;
  if (font.scale !== undefined && !isThemeScale(font.scale)) {
    return { ok: false, error: `Scale must be ${joinWithOr(THEME_SCALES.map(String))}.` };
  }

  const overrides = (
    typeof value.overrides === 'object' && value.overrides !== null ? value.overrides : {}
  ) as Record<string, unknown>;
  for (const key of Object.keys(overrides)) {
    if (!key.startsWith('--')) {
      return { ok: false, error: 'Overrides must be CSS custom properties (e.g. --focus).' };
    }
  }

  const theme: Theme = {
    name: typeof value.name === 'string' ? value.name : DEFAULT_THEME.name,
    base: isThemeBase(value.base) ? value.base : DEFAULT_THEME.base,
    font: {
      ui: typeof font.ui === 'string' ? font.ui : DEFAULT_THEME.font.ui,
      mono: typeof font.mono === 'string' ? font.mono : DEFAULT_THEME.font.mono,
      scale: isThemeScale(font.scale) ? font.scale : DEFAULT_THEME.font.scale,
      ligatures: typeof font.ligatures === 'boolean' ? font.ligatures : DEFAULT_THEME.font.ligatures,
    },
    density: (THEME_DENSITIES as readonly unknown[]).includes(value.density)
      ? (value.density as ThemeDensity)
      : DEFAULT_THEME.density,
    motion: (THEME_MOTIONS as readonly unknown[]).includes(value.motion)
      ? (value.motion as ThemeMotion)
      : DEFAULT_THEME.motion,
    stream: (THEME_STREAMS as readonly unknown[]).includes(value.stream)
      ? (value.stream as ThemeStream)
      : DEFAULT_THEME.stream,
    trace: (THEME_TRACE_DENSITIES as readonly unknown[]).includes(value.trace)
      ? (value.trace as ThemeTraceDensity)
      : DEFAULT_THEME.trace,
    overrides: value.overrides !== undefined ? (overrides as Record<string, string>) : DEFAULT_THEME.overrides,
  };

  return { ok: true, theme };
}

function fontStack(primary: string, fallback: string): string {
  return `'${primary}', ${fallback}`;
}

// Spec §3.6: Calm 45 · Normal 65 · Instant ∞ (see stream/useJitterBuffer.ts's
// SPEED_BASE). The CSS var can't hold Infinity, so Instant publishes 0 as the
// "do not throttle" sentinel for any future CSS-driven consumer.
const STREAM_CPS: Record<ThemeStream, string> = { calm: '45', normal: '65', instant: '0' };

const MOTION_BASE_MS: Record<string, number> = {
  '--m-tap': 90,
  '--m-ui': 160,
  '--m-enter': 240,
  '--m-glyph': 120,
};
const MOTION_MULTIPLIER: Record<ThemeMotion, number> = { full: 1, reduced: 0.5, none: 0 };

const TYPE_SCALE_BASE: Record<string, { size: number; lineHeight: number }> = {
  't-11': { size: 11, lineHeight: 16 },
  't-12': { size: 12, lineHeight: 18 },
  't-13': { size: 13, lineHeight: 20 },
  't-14': { size: 14, lineHeight: 22 },
  't-16': { size: 16, lineHeight: 24 },
  't-20': { size: 20, lineHeight: 28 },
  't-28': { size: 28, lineHeight: 34 },
};

// Only OLED and High Contrast diverge from the Ash Dark / Chalk Light values
// already declared in indra-tokens.css — dark and light apply nothing here
// beyond the `.light` class toggle, so the stylesheet stays the source of
// truth for the two bases most people use.
const BASE_VARS: Record<ThemeBase, Record<string, string>> = {
  dark: {},
  light: {},
  oled: { '--bg': '#000000', '--surface': '#050505', '--raised': '#0a0a0a' },
  'high-contrast': {
    '--line': '#666666',
    '--line-strong': '#999999',
    '--text-dim': '#b3b3b3',
  },
};

const appliedProperties = new WeakMap<HTMLElement, Set<string>>();

/**
 * Applies a theme to the live document (or a scoped preview element). There
 * is no restart step: every call takes effect immediately, and a custom
 * property a later theme no longer sets is removed rather than left stale —
 * required for both "switch base back" and "clear a house override".
 */
export function applyTheme(theme: Theme, target: HTMLElement = document.documentElement): void {
  target.classList.toggle('light', theme.base === 'light');
  target.setAttribute('data-indra-base', theme.base);
  target.setAttribute('data-indra-motion', theme.motion);
  target.setAttribute('data-trace-density', theme.trace);

  const desired = new Map<string, string>();

  for (const [name, value] of Object.entries(BASE_VARS[theme.base])) {
    desired.set(name, value);
  }

  desired.set('--font-ui', fontStack(theme.font.ui, 'ui-sans-serif, system-ui'));
  desired.set('--font-mono', fontStack(theme.font.mono, 'ui-monospace, SFMono-Regular'));
  desired.set('--mono-ligatures', theme.font.ligatures ? '"liga" 1' : '"liga" 0');

  if (theme.font.scale !== 1) {
    for (const [key, { size, lineHeight }] of Object.entries(TYPE_SCALE_BASE)) {
      desired.set(`--${key}`, `${Math.round(size * theme.font.scale)}px`);
      desired.set(`--${key}--line-height`, `${Math.round(lineHeight * theme.font.scale)}px`);
    }
  }

  if (theme.density === 'comfortable') {
    desired.set('--space-6', '24px');
  }

  const motionScale = MOTION_MULTIPLIER[theme.motion];
  if (motionScale !== 1) {
    for (const [name, baseMs] of Object.entries(MOTION_BASE_MS)) {
      desired.set(name, `${Math.round(baseMs * motionScale)}ms`);
    }
  }

  desired.set('--stream-cps', STREAM_CPS[theme.stream]);

  for (const [name, value] of Object.entries(theme.overrides)) {
    desired.set(name, value);
  }

  const previous = appliedProperties.get(target);
  if (previous) {
    for (const name of previous) {
      if (!desired.has(name)) target.style.removeProperty(name);
    }
  }
  for (const [name, value] of desired) {
    target.style.setProperty(name, value);
  }
  appliedProperties.set(target, new Set(desired.keys()));
}
