import type { CSSProperties } from 'react';
import type { SourceBox } from '../../indra/events';
import { Sheet } from './Sheet';

export interface SourceReaderProps {
  pageImageUrl: string;
  boxes: SourceBox[];
  showOverlay: boolean;
  highlightedBoxId?: string;
  onToggleOverlay: () => void;
  onBoxClick: (box: SourceBox) => void;
  /** Reader is mounted for as long as it should be shown; this only wires
   * Esc/backdrop dismissal through to the caller that owns that state. */
  onClose?: () => void;
}

const LOW_CONFIDENCE_THRESHOLD = 0.6;

function noop(): void {}

function boxKey(box: SourceBox, index: number): string {
  return `${box.doc_id}:${box.version}:${box.page}:${index}`;
}

// Confidence-weighted border: 1px at full confidence, widening to 2px by the
// time confidence drops to the 0.60 hedge threshold (spec §5.6).
export function borderWidthForConfidence(conf: number): number {
  const clamped = Math.min(Math.max(conf, 0), 1);
  if (clamped <= LOW_CONFIDENCE_THRESHOLD) return 2;
  const t = (1 - clamped) / (1 - LOW_CONFIDENCE_THRESHOLD);
  return 1 + t;
}

const controlBarStyle: CSSProperties = {
  flexShrink: 0,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  height: 40,
  padding: '0 var(--space-5)',
  borderBottom: '1px solid var(--line)',
};

/**
 * Spec §5.6: the original scan renders at full fidelity; OCR boxes are a
 * toggleable overlay, never baked into the image. Confidence is carried by
 * border weight, and a box below the 0.60 hedge threshold also gets a
 * `--degraded` outline and a text label - colour is never the sole signal.
 */
export function SourceReader({
  pageImageUrl,
  boxes,
  showOverlay,
  highlightedBoxId,
  onToggleOverlay,
  onBoxClick,
  onClose,
}: SourceReaderProps) {
  return (
    <Sheet open width={520} onClose={onClose ?? noop} title="Source">
      <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
        <div style={controlBarStyle}>
          <span
            style={{
              fontSize: 'var(--t-12)',
              lineHeight: 'var(--t-12--line-height)',
              color: 'var(--text-dim)',
            }}
          >
            OCR overlay
          </span>
          <button
            type="button"
            onClick={onToggleOverlay}
            aria-pressed={showOverlay}
            aria-label={showOverlay ? 'Hide OCR overlay' : 'Show OCR overlay'}
            style={{
              height: 24,
              padding: '0 var(--space-3)',
              background: 'transparent',
              border: '1px solid var(--line)',
              borderRadius: 'var(--r-sm)',
              color: 'var(--text)',
              fontFamily: 'var(--font-ui)',
              fontSize: 'var(--t-11)',
              cursor: 'pointer',
            }}
          >
            {showOverlay ? 'Hide overlay' : 'Show overlay'}
          </button>
        </div>
        <div
          style={{
            position: 'relative',
            flex: '1 1 auto',
            minHeight: 0,
            overflow: 'auto',
            background: 'var(--bg)',
          }}
        >
          <div style={{ position: 'relative', display: 'inline-block' }}>
            <img src={pageImageUrl} alt="Source document page" style={{ display: 'block' }} />
            {showOverlay
              ? boxes.map((box, index) => {
                  const key = boxKey(box, index);
                  const lowConfidence = box.conf < LOW_CONFIDENCE_THRESHOLD;
                  const borderWidth = borderWidthForConfidence(box.conf);
                  const highlighted = highlightedBoxId === key;
                  return (
                    <button
                      key={key}
                      type="button"
                      data-testid="ocr-box"
                      onClick={() => onBoxClick(box)}
                      aria-label={
                        lowConfidence
                          ? `OCR region, page ${box.page}, low confidence`
                          : `OCR region, page ${box.page}`
                      }
                      style={{
                        position: 'absolute',
                        left: box.bbox[0],
                        top: box.bbox[1],
                        width: box.bbox[2],
                        height: box.bbox[3],
                        padding: 0,
                        background: highlighted ? 'rgba(76, 125, 240, 0.14)' : 'transparent',
                        border: `${borderWidth}px solid ${
                          lowConfidence ? 'var(--degraded)' : 'var(--line-strong)'
                        }`,
                        borderRadius: 'var(--r-sm)',
                        cursor: 'pointer',
                      }}
                    />
                  );
                })
              : null}
          </div>
        </div>
      </div>
    </Sheet>
  );
}
