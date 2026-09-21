import { useId, useState, type CSSProperties } from 'react';
import {
  THEME_BASES,
  THEME_DENSITIES,
  THEME_MOTIONS,
  THEME_SCALES,
  THEME_STREAMS,
  THEME_TRACE_DENSITIES,
  applyTheme,
  parseTheme,
  serialiseTheme,
  type Theme,
  type ThemeBase,
  type ThemeDensity,
  type ThemeMotion,
  type ThemeScale,
  type ThemeStream,
  type ThemeTraceDensity,
} from '../../indra/theme';

export interface AppearancePanelProps {
  theme: Theme;
  onChange: (theme: Theme) => void;
}

const BASE_LABELS: Record<ThemeBase, string> = {
  dark: 'Ash Dark',
  light: 'Chalk Light',
  'high-contrast': 'High Contrast',
  oled: 'OLED true-black',
};

const DENSITY_LABELS: Record<ThemeDensity, string> = {
  compact: 'Compact',
  comfortable: 'Comfortable',
};

const MOTION_LABELS: Record<ThemeMotion, string> = {
  full: 'Full',
  reduced: 'Reduced',
  none: 'Off',
};

const STREAM_LABELS: Record<ThemeStream, string> = {
  calm: 'Calm',
  normal: 'Normal',
  instant: 'Instant',
};

const TRACE_LABELS: Record<ThemeTraceDensity, string> = {
  quiet: 'Quiet',
  normal: 'Normal',
  trace: 'Trace',
};

const SCALE_OPTIONS: readonly string[] = THEME_SCALES.map((scale) => String(scale));
const SCALE_LABELS: Record<string, string> = Object.fromEntries(
  THEME_SCALES.map((scale): [string, string] => [String(scale), `${Math.round(scale * 100)}%`])
);

const field: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 'var(--space-2)',
};

const label: CSSProperties = {
  fontSize: 'var(--t-12)',
  lineHeight: 'var(--t-12--line-height)',
  color: 'var(--text-dim)',
};

const control: CSSProperties = {
  height: 32,
  padding: '0 var(--space-4)',
  background: 'var(--bg)',
  border: '1px solid var(--line-strong)',
  borderRadius: 'var(--r-sm)',
  color: 'var(--text-hi)',
  fontFamily: 'var(--font-ui)',
  fontSize: 'var(--t-13)',
  lineHeight: 'var(--t-13--line-height)',
};

const panel: CSSProperties = {
  border: '1px solid var(--line)',
  borderRadius: 'var(--r-md)',
  background: 'var(--surface)',
  padding: 'var(--space-6)',
  display: 'flex',
  flexDirection: 'column',
  gap: 'var(--space-5)',
};

const panelTitle: CSSProperties = {
  margin: 0,
  fontSize: 'var(--t-12)',
  lineHeight: 'var(--t-12--line-height)',
  fontWeight: 500,
  color: 'var(--text-dim)',
};

function Select<Value extends string>({
  fieldLabel,
  value,
  options,
  labels,
  onChange,
}: {
  fieldLabel: string;
  value: Value;
  options: readonly Value[];
  labels: Record<Value, string>;
  onChange: (value: Value) => void;
}) {
  const id = useId();

  return (
    <div style={field}>
      <label style={label} htmlFor={id}>
        {fieldLabel}
      </label>
      <select
        id={id}
        value={value}
        onChange={(event) => onChange(event.target.value as Value)}
        style={control}
      >
        {options.map((option) => (
          <option key={option} value={option}>
            {labels[option]}
          </option>
        ))}
      </select>
    </div>
  );
}

/**
 * Preview markup is deliberately self-contained rather than importing the
 * real chat/tool-row/code-block components: it must keep rendering — and
 * keep proving the theme reads correctly — regardless of what those
 * components' own props require at any given point in the build.
 */
function PreviewPane() {
  return (
    <div
      style={{
        ...panel,
        gap: 'var(--space-6)',
      }}
    >
      <h2 style={panelTitle}>Preview</h2>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
        <p
          style={{
            alignSelf: 'flex-end',
            margin: 0,
            maxWidth: '80%',
            padding: 'var(--space-3) var(--space-4)',
            background: 'var(--raised)',
            borderRadius: 'var(--r-md)',
            fontFamily: 'var(--font-ui)',
            fontSize: 'var(--t-14)',
            lineHeight: 'var(--t-14--line-height)',
            color: 'var(--text-hi)',
          }}
        >
          What is the wall-thickness reading on page 4 of the August NDT report?
        </p>
        <p
          style={{
            margin: 0,
            fontFamily: 'var(--font-ui)',
            fontSize: 'var(--t-14)',
            lineHeight: 'var(--t-14--line-height)',
            color: 'var(--text)',
          }}
        >
          {'The reading is 6.2 mm at the flagged location '}
          <span
            aria-hidden="true"
            style={{ color: 'var(--text-dim)', textDecoration: 'underline', textDecorationColor: 'var(--focus)' }}
          >
            {'⟦1⟧'}
          </span>
          {'.'}
        </p>
      </div>

      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 'var(--space-3)',
          height: 32,
          padding: '0 var(--space-4)',
          background: 'var(--raised)',
          borderRadius: 'var(--r-sm)',
          fontFamily: 'var(--font-ui)',
          fontSize: 'var(--t-13)',
          lineHeight: 'var(--t-13--line-height)',
          color: 'var(--text)',
        }}
      >
        <span aria-hidden="true" style={{ color: 'var(--text-dim)' }}>
          {'⟶'}
        </span>
        <span style={{ fontFamily: 'var(--font-mono)' }}>ocr_document</span>
        <span style={{ flex: '1 1 auto' }} />
        <span
          aria-hidden="true"
          style={{ width: 6, height: 6, borderRadius: 'var(--r-full)', background: 'var(--sealed)' }}
        />
        <span style={{ color: 'var(--text-dim)' }}>sandboxed, no network</span>
      </div>

      <pre
        style={{
          margin: 0,
          padding: 'var(--space-4)',
          background: 'var(--bg)',
          border: '1px solid var(--line)',
          borderRadius: 'var(--r-sm)',
          overflowX: 'auto',
          fontFamily: 'var(--font-mono)',
          fontFeatureSettings: 'var(--mono-ligatures)',
          fontSize: 'var(--t-13)',
          lineHeight: 'var(--t-13--line-height)',
          color: 'var(--text)',
        }}
      >
        {'fn wall_thickness(reading_mm: f64) -> bool {\n  reading_mm >= 6.0\n}'}
      </pre>
    </div>
  );
}

export function AppearancePanel({ theme, onChange }: AppearancePanelProps) {
  const [blob, setBlob] = useState(() => serialiseTheme(theme));
  const [error, setError] = useState<string | null>(null);
  const uiFontId = useId();
  const monoFontId = useId();
  const ligaturesId = useId();
  const blobId = useId();

  function commit(next: Theme) {
    applyTheme(next);
    onChange(next);
  }

  function applyBlob() {
    const result = parseTheme(blob);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setError(null);
    setBlob(serialiseTheme(result.theme));
    commit(result.theme);
  }

  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: 'minmax(240px, 320px) 1fr',
        gap: 'var(--space-7)',
        fontFamily: 'var(--font-ui)',
        color: 'var(--text)',
      }}
    >
      <div style={panel}>
        <h2 style={panelTitle}>Appearance</h2>

        <Select
          fieldLabel="Base"
          value={theme.base}
          options={THEME_BASES}
          labels={BASE_LABELS}
          onChange={(base) => commit({ ...theme, base })}
        />

        <div style={field}>
          <label style={label} htmlFor={uiFontId}>
            UI font
          </label>
          <input
            id={uiFontId}
            type="text"
            value={theme.font.ui}
            onChange={(event) => commit({ ...theme, font: { ...theme.font, ui: event.target.value } })}
            style={control}
          />
        </div>

        <div style={field}>
          <label style={label} htmlFor={monoFontId}>
            Mono font
          </label>
          <input
            id={monoFontId}
            type="text"
            value={theme.font.mono}
            onChange={(event) =>
              commit({ ...theme, font: { ...theme.font, mono: event.target.value } })
            }
            style={control}
          />
        </div>

        <Select
          fieldLabel="Scale"
          value={String(theme.font.scale)}
          options={SCALE_OPTIONS}
          labels={SCALE_LABELS}
          onChange={(scale) =>
            commit({ ...theme, font: { ...theme.font, scale: Number(scale) as ThemeScale } })
          }
        />

        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
          <input
            id={ligaturesId}
            type="checkbox"
            checked={theme.font.ligatures}
            onChange={(event) =>
              commit({ ...theme, font: { ...theme.font, ligatures: event.target.checked } })
            }
          />
          <label htmlFor={ligaturesId} style={label}>
            Mono ligatures
          </label>
        </div>

        <Select
          fieldLabel="Density"
          value={theme.density}
          options={THEME_DENSITIES}
          labels={DENSITY_LABELS}
          onChange={(density) => commit({ ...theme, density })}
        />

        <Select
          fieldLabel="Motion"
          value={theme.motion}
          options={THEME_MOTIONS}
          labels={MOTION_LABELS}
          onChange={(motion) => commit({ ...theme, motion })}
        />

        <Select
          fieldLabel="Stream speed"
          value={theme.stream}
          options={THEME_STREAMS}
          labels={STREAM_LABELS}
          onChange={(stream) => commit({ ...theme, stream })}
        />

        <Select
          fieldLabel="Trace density"
          value={theme.trace}
          options={THEME_TRACE_DENSITIES}
          labels={TRACE_LABELS}
          onChange={(trace) => commit({ ...theme, trace })}
        />

        <div style={field}>
          <label style={label} htmlFor={blobId}>
            Theme text
          </label>
          <textarea
            id={blobId}
            value={blob}
            onChange={(event) => setBlob(event.target.value)}
            rows={6}
            spellCheck={false}
            style={{
              ...control,
              height: 'auto',
              padding: 'var(--space-3) var(--space-4)',
              fontFamily: 'var(--font-mono)',
              fontSize: 'var(--t-12)',
              lineHeight: 'var(--t-12--line-height)',
              resize: 'vertical',
            }}
          />
          <button
            type="button"
            onClick={applyBlob}
            className="indra-focusable"
            style={{
              alignSelf: 'flex-start',
              height: 28,
              padding: '0 var(--space-5)',
              background: 'var(--raised)',
              border: '1px solid var(--line-strong)',
              borderRadius: 'var(--r-sm)',
              color: 'var(--text-hi)',
              fontFamily: 'var(--font-ui)',
              fontSize: 'var(--t-12)',
              fontWeight: 500,
              cursor: 'pointer',
            }}
          >
            Apply theme text
          </button>
          {error ? (
            <p
              role="alert"
              style={{
                margin: 0,
                display: 'flex',
                gap: 'var(--space-3)',
                borderLeftWidth: '2px',
                borderLeftStyle: 'solid',
                borderLeftColor: 'var(--blocked)',
                paddingLeft: 'var(--space-4)',
                fontSize: 'var(--t-12)',
                lineHeight: 'var(--t-12--line-height)',
              }}
            >
              <span aria-hidden="true" style={{ color: 'var(--blocked)' }}>
                {'▲'}
              </span>
              <span style={{ whiteSpace: 'normal', overflowWrap: 'anywhere' }}>{error}</span>
            </p>
          ) : null}
        </div>
      </div>

      <PreviewPane />
    </div>
  );
}
