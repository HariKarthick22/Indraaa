import type { StreamSpeedName } from './stream/useJitterBuffer';

export type ThemeBase = 'dark' | 'light' | 'high-contrast' | 'oled';
export type ThemeDensity = 'compact' | 'comfortable';
export type ThemeMotion = 'full' | 'reduced' | 'none';
export type TraceDensityLevel = 'quiet' | 'normal' | 'trace';

export interface ThemeFont {
  ui: string;
  mono: string;
  scale: number;
  ligatures: boolean;
}

/**
 * Spec §3.6. A theme is an override object under 1 kB, serialisable to a text
 * blob a plant can paste into a field and apply — no rebuild, no theme store,
 * no network.
 */
export interface Theme {
  name: string;
  base: ThemeBase;
  font: ThemeFont;
  density: ThemeDensity;
  motion: ThemeMotion;
  stream: StreamSpeedName;
  trace: TraceDensityLevel;
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

/** Stays pasteable into a single field — enforced by `parseTheme`. */
export const THEME_BLOB_LIMIT = 1024;

const VALID_BASES: readonly ThemeBase[] = ['dark', 'light', 'high-contrast', 'oled'];
const VALID_SCALES: readonly number[] = [0.9, 1, 1.1, 1.25];

export function themeByteLength(blob: string): number {
  return new TextEncoder().encode(blob).length;
}

export function serialiseTheme(theme: Theme): string {
  return JSON.stringify(theme);
}

export type ParseThemeResult = { ok: true; theme: Theme } | { ok: false; error: string };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * Merges partial JSON onto `DEFAULT_THEME` — a house theme only needs to name
 * what it changes — then validates the result. Rejections name the exact
 * fields the appearance panel offers, so a pasted-in typo is fixable.
 */
export function parseTheme(blob: string): ParseThemeResult {
  if (themeByteLength(blob) >= THEME_BLOB_LIMIT) {
    return {
      ok: false,
      error: `Theme is too large: it must fit in ${THEME_BLOB_LIMIT} bytes so it stays pasteable.`,
    };
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(blob);
  } catch {
    return { ok: false, error: 'Theme text is not valid JSON.' };
  }

  if (!isRecord(parsed)) {
    return { ok: false, error: 'Theme text is not valid JSON.' };
  }

  const font: ThemeFont = {
    ...DEFAULT_THEME.font,
    ...(isRecord(parsed.font) ? (parsed.font as Partial<ThemeFont>) : {}),
  };

  const theme: Theme = {
    ...DEFAULT_THEME,
    ...parsed,
    font,
    overrides: isRecord(parsed.overrides)
      ? (parsed.overrides as Record<string, string>)
      : DEFAULT_THEME.overrides,
  } as Theme;

  if (!VALID_BASES.includes(theme.base)) {
    return {
      ok: false,
      error: `Unknown theme base "${theme.base}" — choose dark, light, high-contrast or oled.`,
    };
  }

  if (!VALID_SCALES.includes(theme.font.scale)) {
    return {
      ok: false,
      error: `Font scale must be 0.9, 1, 1.1 or 1.25, not ${theme.font.scale}.`,
    };
  }

  for (const prop of Object.keys(theme.overrides)) {
    if (!prop.startsWith('--')) {
      return {
        ok: false,
        error: `Theme overrides must be CSS custom properties (e.g. "--line"), got "${prop}".`,
      };
    }
  }

  return { ok: true, theme };
}

const TYPE_RAMP: Record<string, readonly [size: number, lineHeight: number]> = {
  't-11': [11, 16],
  't-12': [12, 18],
  't-13': [13, 20],
  't-14': [14, 22],
  't-16': [16, 24],
  't-20': [20, 28],
  't-28': [28, 34],
};

const SPACE_SCALE: Record<string, number> = {
  'space-1': 2,
  'space-2': 4,
  'space-3': 6,
  'space-4': 8,
  'space-5': 12,
  'space-6': 16,
  'space-7': 24,
  'space-8': 32,
  'space-9': 48,
  'space-10': 64,
};

// §3.6: "opens the space scale up" for comfortable density.
const COMFORTABLE_MULTIPLIER = 1.5;

const MOTION_TOKENS = ['m-tap', 'm-ui', 'm-enter', 'm-glyph'] as const;

// §3.6: Calm 45 · Normal 65 · Instant is a rate of zero — the jitter buffer
// treats zero as "no per-character delay", not literal infinity.
const STREAM_CPS: Record<StreamSpeedName, number> = { calm: 45, normal: 65, instant: 0 };

const appliedOverrides = new WeakMap<HTMLElement, ReadonlySet<string>>();

/**
 * Applies a theme to the live document (or a scoped element, for a preview)
 * with no restart step. Every call is a full re-derivation from `theme` — a
 * property this call doesn't need is explicitly cleared, not just left from
 * the previous call, so switching themes never leaves a stale override behind.
 */
export function applyTheme(theme: Theme, target: HTMLElement = document.documentElement): void {
  const style = target.style;

  target.classList.toggle('light', theme.base === 'light');
  target.setAttribute('data-indra-base', theme.base);

  if (theme.base === 'oled') {
    style.setProperty('--bg', '#000000');
  } else {
    style.removeProperty('--bg');
  }

  if (theme.base === 'high-contrast') {
    style.setProperty('--line', '#5c5c5c');
    style.setProperty('--line-strong', '#7a7a7a');
  } else {
    style.removeProperty('--line');
    style.removeProperty('--line-strong');
  }

  for (const [token, [size, lineHeight]] of Object.entries(TYPE_RAMP)) {
    style.setProperty(`--${token}`, `${Math.round(size * theme.font.scale)}px`);
    style.setProperty(`--${token}--line-height`, `${Math.round(lineHeight * theme.font.scale)}px`);
  }

  style.setProperty('--font-ui', `'${theme.font.ui}', ui-sans-serif, system-ui`);
  style.setProperty('--font-mono', `'${theme.font.mono}', ui-monospace, SFMono-Regular`);
  style.setProperty('--mono-ligatures', theme.font.ligatures ? '"liga" 1' : '"liga" 0');

  if (theme.density === 'comfortable') {
    for (const [token, base] of Object.entries(SPACE_SCALE)) {
      style.setProperty(`--${token}`, `${Math.round(base * COMFORTABLE_MULTIPLIER)}px`);
    }
  } else {
    for (const token of Object.keys(SPACE_SCALE)) {
      style.removeProperty(`--${token}`);
    }
  }

  target.setAttribute('data-indra-motion', theme.motion);
  if (theme.motion === 'none') {
    for (const token of MOTION_TOKENS) style.setProperty(`--${token}`, '0ms');
  } else {
    for (const token of MOTION_TOKENS) style.removeProperty(`--${token}`);
  }

  style.setProperty('--stream-cps', String(STREAM_CPS[theme.stream]));
  target.setAttribute('data-trace-density', theme.trace);

  // House overrides are applied last so they win over everything the base set,
  // and one a later theme no longer carries is removed rather than left stale.
  const previous = appliedOverrides.get(target) ?? new Set<string>();
  for (const prop of previous) {
    if (!(prop in theme.overrides)) style.removeProperty(prop);
  }
  const next = new Set<string>();
  for (const [prop, value] of Object.entries(theme.overrides)) {
    style.setProperty(prop, value);
    next.add(prop);
  }
  appliedOverrides.set(target, next);
}
