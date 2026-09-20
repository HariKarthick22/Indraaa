import { beforeEach, describe, expect, it } from 'vitest';
import {
  DEFAULT_THEME,
  THEME_BLOB_LIMIT,
  applyTheme,
  parseTheme,
  serialiseTheme,
  themeByteLength,
  type Theme,
} from './theme';

function root(): HTMLElement {
  return document.documentElement;
}

function freshRoot(): HTMLElement {
  const element = root();
  element.removeAttribute('style');
  element.className = '';
  return element;
}

describe('serialiseTheme', () => {
  it('stays under 1 kB so a theme can be pasted into a field', () => {
    const blob = serialiseTheme(DEFAULT_THEME);
    expect(themeByteLength(blob)).toBeLessThan(THEME_BLOB_LIMIT);
  });

  it('round-trips through parseTheme unchanged', () => {
    const theme: Theme = {
      ...DEFAULT_THEME,
      name: 'Refinery House',
      base: 'oled',
      font: { ui: 'IBM Plex Sans', mono: 'JetBrains Mono', scale: 1.1, ligatures: true },
      density: 'comfortable',
      motion: 'reduced',
      stream: 'calm',
      trace: 'trace',
      overrides: { '--line': '#333333' },
    };

    const result = parseTheme(serialiseTheme(theme));
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.theme).toEqual(theme);
  });
});

describe('parseTheme', () => {
  it('accepts the theme shape printed in the spec, filling in what it omits', () => {
    const result = parseTheme(
      '{ "name":"Ash Dark", "base":"dark", "font":{"ui":"Geist Sans","mono":"Geist Mono","scale":1.0,"ligatures":false}, "density":"compact", "overrides":{"--focus":"#4C7DF0"} }'
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.theme.name).toBe('Ash Dark');
    expect(result.theme.overrides).toEqual({ '--focus': '#4C7DF0' });
    expect(result.theme.motion).toBe(DEFAULT_THEME.motion);
    expect(result.theme.trace).toBe(DEFAULT_THEME.trace);
  });

  it('rejects text that is not JSON, and says so', () => {
    const result = parseTheme('not a theme');
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/valid json/i);
  });

  it('rejects a blob over the 1 kB limit', () => {
    const fat = serialiseTheme({
      ...DEFAULT_THEME,
      overrides: Object.fromEntries(
        Array.from({ length: 80 }, (_, i) => [`--token-${i}`, '#123456']),
      ),
    });
    const result = parseTheme(fat);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/1024 bytes/);
  });

  it('rejects an unknown base and names the ones that exist', () => {
    const result = parseTheme('{"base":"midnight"}');
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/dark, light, high-contrast or oled/);
  });

  it('rejects a scale outside the four the panel offers', () => {
    const result = parseTheme('{"font":{"scale":2}}');
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/0\.9, 1, 1\.1 or 1\.25/);
  });

  it('rejects overrides that are not CSS custom properties', () => {
    const result = parseTheme('{"overrides":{"background":"red"}}');
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/custom propert/i);
  });
});

describe('applyTheme', () => {
  beforeEach(() => {
    freshRoot();
  });

  it('applies instantly to the live document — there is no restart step', () => {
    applyTheme({ ...DEFAULT_THEME, base: 'light' });
    expect(root().classList.contains('light')).toBe(true);

    applyTheme({ ...DEFAULT_THEME, base: 'dark' });
    expect(root().classList.contains('light')).toBe(false);
  });

  it('sets the OLED ground to true black and clears it again on the way back', () => {
    applyTheme({ ...DEFAULT_THEME, base: 'oled' });
    expect(root().style.getPropertyValue('--bg')).toBe('#000000');

    applyTheme({ ...DEFAULT_THEME, base: 'dark' });
    expect(root().style.getPropertyValue('--bg')).toBe('');
  });

  it('raises the line contrast in the High Contrast base', () => {
    applyTheme({ ...DEFAULT_THEME, base: 'high-contrast' });
    expect(root().style.getPropertyValue('--line')).not.toBe('');
    expect(root().getAttribute('data-indra-base')).toBe('high-contrast');
  });

  it('scales the type ramp and its line heights together', () => {
    applyTheme({ ...DEFAULT_THEME, font: { ...DEFAULT_THEME.font, scale: 1.25 } });
    expect(root().style.getPropertyValue('--t-14')).toBe('18px');
    expect(root().style.getPropertyValue('--t-14--line-height')).toBe('28px');
  });

  it('sets the chosen font stacks with their fallbacks', () => {
    applyTheme({
      ...DEFAULT_THEME,
      font: { ...DEFAULT_THEME.font, ui: 'IBM Plex Sans', mono: 'JetBrains Mono' },
    });
    expect(root().style.getPropertyValue('--font-ui')).toContain('IBM Plex Sans');
    expect(root().style.getPropertyValue('--font-ui')).toContain('ui-sans-serif');
    expect(root().style.getPropertyValue('--font-mono')).toContain('JetBrains Mono');
  });

  it('switches mono ligatures on and off', () => {
    applyTheme({ ...DEFAULT_THEME, font: { ...DEFAULT_THEME.font, ligatures: true } });
    expect(root().style.getPropertyValue('--mono-ligatures')).toContain('"liga" 1');

    applyTheme({ ...DEFAULT_THEME, font: { ...DEFAULT_THEME.font, ligatures: false } });
    expect(root().style.getPropertyValue('--mono-ligatures')).toContain('"liga" 0');
  });

  it('opens the space scale up for comfortable density', () => {
    applyTheme({ ...DEFAULT_THEME, density: 'comfortable' });
    expect(root().style.getPropertyValue('--space-6')).toBe('24px');

    applyTheme({ ...DEFAULT_THEME, density: 'compact' });
    expect(root().style.getPropertyValue('--space-6')).toBe('');
  });

  it('zeroes every motion token when motion is off', () => {
    applyTheme({ ...DEFAULT_THEME, motion: 'none' });
    expect(root().style.getPropertyValue('--m-ui')).toBe('0ms');
    expect(root().style.getPropertyValue('--m-enter')).toBe('0ms');
    expect(root().getAttribute('data-indra-motion')).toBe('none');
  });

  it('publishes the stream speed in characters per second', () => {
    applyTheme({ ...DEFAULT_THEME, stream: 'calm' });
    expect(root().style.getPropertyValue('--stream-cps')).toBe('45');

    applyTheme({ ...DEFAULT_THEME, stream: 'instant' });
    expect(root().style.getPropertyValue('--stream-cps')).toBe('0');
  });

  it('publishes trace density as an attribute the trace surfaces read', () => {
    applyTheme({ ...DEFAULT_THEME, trace: 'trace' });
    expect(root().getAttribute('data-trace-density')).toBe('trace');
  });

  it('lets a house override win over everything the base set', () => {
    applyTheme({ ...DEFAULT_THEME, base: 'oled', overrides: { '--bg': '#020202' } });
    expect(root().style.getPropertyValue('--bg')).toBe('#020202');
  });

  it('removes an override that a later theme no longer carries', () => {
    applyTheme({ ...DEFAULT_THEME, overrides: { '--line': '#444444' } });
    expect(root().style.getPropertyValue('--line')).toBe('#444444');

    applyTheme(DEFAULT_THEME);
    expect(root().style.getPropertyValue('--line')).toBe('');
  });

  it('applies to any element, so a preview can be scoped', () => {
    const element = document.createElement('div');
    applyTheme({ ...DEFAULT_THEME, base: 'oled' }, element);
    expect(element.style.getPropertyValue('--bg')).toBe('#000000');
    expect(root().style.getPropertyValue('--bg')).toBe('');
  });
});
