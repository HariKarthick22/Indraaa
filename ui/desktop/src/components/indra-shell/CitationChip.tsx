import { useEffect, useRef, useState } from 'react';
import type { SourceBox } from '../../indra/events';
import { useReducedMotion } from '../../indra/useReducedMotion';

export interface CitationChipProps {
  index: number;
  source: SourceBox;
  onOpen: (source: SourceBox) => void;
}

const HOVER_DELAY_MS = 220;
const LOW_CONFIDENCE_THRESHOLD = 0.6;
const PREVIEW_WIDTH = 240;

function formatConfidence(conf: number): string {
  return `${Math.round(conf * 100)}%`;
}

/**
 * Spec §6.4. Inline `⟦1⟧`, dim at rest. Confidence below 0.60 carries a small
 * degraded dot with its own aria-label — distinct wording from the button's
 * own label so a screen reader does not hit the same fact twice on one
 * element, but colour is still never the sole carrier of the signal. The
 * sentence itself is never hedged by the UI; the model was instructed to
 * hedge in words.
 */
export function CitationChip({ index, source, onOpen }: CitationChipProps) {
  const reduced = useReducedMotion();
  const [previewOpen, setPreviewOpen] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (timerRef.current !== null) clearTimeout(timerRef.current);
    },
    []
  );

  const lowConfidence = source.conf < LOW_CONFIDENCE_THRESHOLD;
  const label = `Citation ${index}, page ${source.page}${lowConfidence ? ', low confidence' : ''}`;

  const openPreview = () => {
    if (reduced) {
      setPreviewOpen(true);
      return;
    }
    timerRef.current = setTimeout(() => setPreviewOpen(true), HOVER_DELAY_MS);
  };

  const closePreview = () => {
    if (timerRef.current !== null) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    setPreviewOpen(false);
  };

  return (
    <span style={{ position: 'relative', display: 'inline-block' }}>
      <button
        type="button"
        aria-label={label}
        onClick={() => onOpen(source)}
        onMouseEnter={openPreview}
        onMouseLeave={closePreview}
        onFocus={openPreview}
        onBlur={closePreview}
        className="indra-focusable"
        style={{
          display: 'inline-flex',
          alignItems: 'baseline',
          gap: 'var(--space-1)',
          verticalAlign: 'baseline',
          fontFamily: 'var(--font-mono)',
          fontSize: 'var(--t-12)',
          lineHeight: 'inherit',
          color: 'var(--text-dim)',
          background: 'transparent',
          border: 'none',
          padding: 0,
          cursor: 'pointer',
        }}
        onMouseOver={(e) => {
          e.currentTarget.style.color = 'var(--text-hi)';
          e.currentTarget.style.textDecoration = 'underline';
          e.currentTarget.style.textDecorationColor = 'var(--focus)';
        }}
        onMouseOut={(e) => {
          e.currentTarget.style.color = 'var(--text-dim)';
          e.currentTarget.style.textDecoration = 'none';
        }}
      >
        <span>{`⟦${index}⟧`}</span>
        {lowConfidence ? (
          <span
            aria-label="confidence below 60%"
            style={{
              width: 4,
              height: 4,
              flexShrink: 0,
              alignSelf: 'center',
              borderRadius: 'var(--r-full)',
              background: 'var(--degraded)',
            }}
          />
        ) : null}
      </button>

      {previewOpen ? (
        <span
          role="tooltip"
          className="indra-rise"
          style={{
            position: 'absolute',
            bottom: '100%',
            left: 0,
            marginBottom: 'var(--space-2)',
            width: PREVIEW_WIDTH,
            zIndex: 20,
            display: 'flex',
            flexDirection: 'column',
            gap: 'var(--space-2)',
            padding: 'var(--space-3)',
            background: 'var(--surface)',
            border: '1px solid var(--line)',
            borderRadius: 'var(--r-md)',
            fontFamily: 'var(--font-ui)',
            fontSize: 'var(--t-11)',
            lineHeight: 'var(--t-11--line-height)',
            color: 'var(--text-dim)',
          }}
        >
          <span
            aria-hidden="true"
            style={{
              width: '100%',
              height: 120,
              borderRadius: 'var(--r-sm)',
              background: 'var(--raised)',
              border: '1px solid var(--line)',
            }}
          />
          <span
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: 'var(--t-11)',
              color: 'var(--text-faint)',
              overflowWrap: 'anywhere',
            }}
          >
            {source.doc_id}
          </span>
          <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontFamily: 'var(--font-mono)', fontVariantNumeric: 'tabular-nums' }}>
              {`page ${source.page}`}
            </span>
            <span style={{ fontFamily: 'var(--font-mono)', fontVariantNumeric: 'tabular-nums' }}>
              {`${formatConfidence(source.conf)} confidence`}
            </span>
          </span>
          {lowConfidence ? (
            <span style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
              <span
                aria-hidden="true"
                style={{
                  width: 4,
                  height: 4,
                  flexShrink: 0,
                  borderRadius: 'var(--r-full)',
                  background: 'var(--degraded)',
                }}
              />
              <span style={{ color: 'var(--degraded)' }}>low confidence</span>
            </span>
          ) : null}
        </span>
      ) : null}
    </span>
  );
}
