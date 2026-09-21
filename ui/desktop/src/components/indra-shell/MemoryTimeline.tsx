import { useCallback, useMemo, useState, type CSSProperties, type FocusEvent } from 'react';

export type TimelineEventKind = 'version-bump' | 'cache-fill' | 'invalidation' | 'citation';

export interface TimelineEvent {
  id: string;
  kind: TimelineEventKind;
  /** ISO timestamp — orders the marker along the lane and labels it. */
  at: string;
  version: string;
  label: string;
  /**
   * Citation events only: was `version` already superseded when the citation
   * was made? Spec: this is the question an auditor actually asks, so it is
   * the one fact this component exists to surface.
   */
  supersededAtCitation?: boolean;
  /** Citation events only: the session that made the citation. */
  sessionId?: string;
}

export interface MemoryTimelineLane {
  documentId: string;
  documentLabel: string;
  events: TimelineEvent[];
}

export interface MemoryTimelineProps {
  lanes: MemoryTimelineLane[];
  onCitationClick?: (sessionId: string) => void;
}

const KIND_GLYPH: Record<TimelineEventKind, string> = {
  'version-bump': '▮',
  'cache-fill': '●',
  invalidation: '○',
  citation: '▸',
};

const KIND_LABEL: Record<TimelineEventKind, string> = {
  'version-bump': 'Version bump',
  'cache-fill': 'Cache fill',
  invalidation: 'Invalidation',
  citation: 'Citation',
};

type TimeRange = readonly [number, number];

function computeTimeRange(lanes: MemoryTimelineLane[]): TimeRange {
  let min = Infinity;
  let max = -Infinity;
  for (const lane of lanes) {
    for (const event of lane.events) {
      const t = new Date(event.at).getTime();
      if (Number.isNaN(t)) continue;
      if (t < min) min = t;
      if (t > max) max = t;
    }
  }
  if (!Number.isFinite(min) || !Number.isFinite(max) || min === max) {
    return [min, min + 1];
  }
  return [min, max];
}

function positionPercent(at: string, [min, max]: TimeRange): number {
  const t = new Date(at).getTime();
  if (Number.isNaN(t) || max === min) return 0;
  return ((t - min) / (max - min)) * 100;
}

function useFocusRing() {
  const [focused, setFocused] = useState(false);
  const onFocus = useCallback((_event: FocusEvent<HTMLElement>) => setFocused(true), []);
  const onBlur = useCallback((_event: FocusEvent<HTMLElement>) => setFocused(false), []);
  const ringStyle: CSSProperties = focused
    ? { outline: '2px solid var(--focus)', outlineOffset: '2px' }
    : { outline: 'none' };
  return { onFocus, onBlur, ringStyle };
}

interface TimelineMarkerProps {
  event: TimelineEvent;
  percent: number;
  onCitationClick?: (sessionId: string) => void;
}

function TimelineMarker({ event, percent, onCitationClick }: TimelineMarkerProps) {
  const { onFocus, onBlur, ringStyle } = useFocusRing();
  const degraded = event.kind === 'citation' && event.supersededAtCitation === true;
  const label = degraded
    ? `${event.label} — cites a superseded version (${event.version})`
    : `${KIND_LABEL[event.kind]}: ${event.label}`;

  const position: CSSProperties = {
    position: 'absolute',
    left: `${percent}%`,
    top: 0,
    transform: 'translateX(-50%)',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 'var(--space-1)',
  };

  const glyph = (
    <span
      aria-hidden="true"
      style={{
        display: 'inline-block',
        fontSize: 'var(--t-13)',
        lineHeight: 1,
        color:
          event.kind === 'invalidation'
            ? 'var(--blocked)'
            : degraded
              ? 'var(--degraded)'
              : 'var(--text-dim)',
      }}
    >
      {KIND_GLYPH[event.kind]}
    </span>
  );

  if (event.kind === 'citation' && event.sessionId) {
    const sessionId = event.sessionId;
    return (
      <button
        type="button"
        onClick={() => onCitationClick?.(sessionId)}
        onFocus={onFocus}
        onBlur={onBlur}
        title={label}
        aria-label={label}
        style={{
          ...position,
          padding: 0,
          background: 'transparent',
          border: 'none',
          cursor: 'pointer',
          ...ringStyle,
        }}
      >
        {glyph}
        {/* Colour is never the only carrier of "superseded" — the ▲ and the
            aria-label say it too (§8). */}
        {degraded ? (
          <span aria-hidden="true" style={{ color: 'var(--degraded)', fontSize: 'var(--t-11)' }}>
            ▲
          </span>
        ) : null}
      </button>
    );
  }

  return (
    <span style={position} title={label} aria-label={label}>
      {glyph}
    </span>
  );
}

function EmptyState() {
  return (
    <div
      style={{
        padding: 'var(--space-7)',
        color: 'var(--text-dim)',
        fontSize: 'var(--t-13)',
        lineHeight: 'var(--t-13--line-height)',
      }}
    >
      No timeline activity yet. It appears once a document version changes or a session cites it.
    </div>
  );
}

/**
 * One horizontal lane per document (Task 19): version bumps, cache fills,
 * invalidations, and citations plotted on a shared time axis so an auditor
 * can see at a glance whether a conclusion depended on a version that has
 * since changed.
 */
export function MemoryTimeline({ lanes, onCitationClick }: MemoryTimelineProps) {
  const range = useMemo(() => computeTimeRange(lanes), [lanes]);

  return (
    <section
      aria-label="Memory timeline"
      style={{
        display: 'flex',
        flexDirection: 'column',
        width: '100%',
        background: 'var(--surface)',
        border: '1px solid var(--line)',
        borderRadius: 'var(--r-md)',
        color: 'var(--text)',
        fontFamily: 'var(--font-ui)',
      }}
    >
      {lanes.length === 0 ? (
        <EmptyState />
      ) : (
        <div style={{ overflowX: 'auto', padding: 'var(--space-5)' }}>
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: 'var(--space-6)',
              minWidth: 640,
            }}
          >
            {lanes.map((lane) => (
              <div
                key={lane.documentId}
                role="group"
                aria-label={lane.documentLabel}
                style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-5)' }}
              >
                <span
                  title={lane.documentLabel}
                  style={{
                    flexShrink: 0,
                    width: 160,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                    color: 'var(--text-hi)',
                    fontSize: 'var(--t-13)',
                    lineHeight: 'var(--t-13--line-height)',
                    fontWeight: 500,
                  }}
                >
                  {lane.documentLabel}
                </span>
                <div
                  style={{
                    position: 'relative',
                    flex: '1 1 auto',
                    height: 28,
                    borderTop: '1px solid var(--line)',
                  }}
                >
                  {lane.events.map((event) => (
                    <TimelineMarker
                      key={event.id}
                      event={event}
                      percent={positionPercent(event.at, range)}
                      onCitationClick={onCitationClick}
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}
