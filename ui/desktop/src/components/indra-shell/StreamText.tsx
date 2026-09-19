import { useCallback, useEffect, useRef, useState, type CSSProperties } from 'react';
import { useReducedMotion } from '../../indra/useReducedMotion';
import { useJitterBuffer, type StreamSpeed } from '../../indra/stream/useJitterBuffer';

export interface StreamTextProps {
  /** The whole text received so far; deltas are appended by the caller. */
  text: string;
  speed?: StreamSpeed;
  /** The turn has ended: the caret is hidden and the text becomes readable. */
  done?: boolean;
  style?: CSSProperties;
}

// Spec §8: the live region announces at sentence granularity. A per-character
// live region makes a screen reader unusable.
export function announcedText(text: string): string {
  const match = text.match(/^[\s\S]*[.!?…]["')\]]?(?=\s|$)/);
  return match ? match[0] : '';
}

const SR_ONLY: CSSProperties = {
  position: 'absolute',
  width: 1,
  height: 1,
  margin: -1,
  padding: 0,
  overflow: 'hidden',
  clipPath: 'inset(50%)',
  whiteSpace: 'nowrap',
  border: 0,
};

// Spec §6.1: 2px block, --text-hi, riding the last committed glyph. Solid while
// streaming, 1.06s blink when idle. (--focus is the composer's caret, not this
// one — §3.2 assigns --text-hi here.)
function Caret({ idle }: { idle: boolean }) {
  return (
    <span
      aria-hidden="true"
      data-testid="stream-caret"
      className={idle ? 'indra-caret indra-caret--idle' : 'indra-caret'}
      style={{
        display: 'inline-block',
        width: 2,
        height: '1em',
        marginLeft: 1,
        verticalAlign: 'text-bottom',
        background: 'var(--text-hi)',
      }}
    />
  );
}

// Spec §6.1: a stall of >900ms swaps the caret for a three-dot breathing
// indicator until deltas resume.
function StallIndicator({ reduced }: { reduced: boolean }) {
  return (
    <span
      aria-hidden="true"
      data-testid="stream-stalled"
      title="Waiting for the model"
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 'var(--space-1)',
        marginLeft: 'var(--space-2)',
        verticalAlign: 'text-bottom',
      }}
    >
      {[0, 1, 2].map((dot) => (
        <span
          key={dot}
          className={reduced ? undefined : 'indra-stall-dot'}
          style={{
            width: 3,
            height: 3,
            borderRadius: 'var(--r-full)',
            background: 'var(--text-dim)',
          }}
        />
      ))}
    </span>
  );
}

export function StreamText({ text, speed = 'normal', done = false, style }: StreamTextProps) {
  const reduced = useReducedMotion();
  const { committed, animating, animatingGraphemes, animatingOffset, stalled, draining, settle } =
    useJitterBuffer({ text, speed, done });

  // Each span unwraps itself the moment its entrance finishes, so the live DOM
  // never holds more than the animating window.
  const unwrap = useCallback(() => settle(1), [settle]);

  const visible = committed + animating;
  const announcedRef = useRef(0);
  const [announcement, setAnnouncement] = useState('');

  useEffect(() => {
    const full = announcedText(visible);
    if (full.length < announcedRef.current) announcedRef.current = 0;
    if (full.length > announcedRef.current) {
      setAnnouncement(full.slice(announcedRef.current));
      announcedRef.current = full.length;
    }
  }, [visible]);

  return (
    <div
      style={{
        fontFamily: 'var(--font-ui)',
        fontSize: 'var(--t-14)',
        lineHeight: 'var(--t-14--line-height)',
        fontWeight: 400,
        color: 'var(--text)',
        maxWidth: '78ch',
        // Reserved so the composer never hops as the first line lands (§6.1).
        minHeight: 'var(--t-14--line-height)',
        whiteSpace: 'pre-wrap',
        textWrap: 'pretty',
        ...style,
      }}
    >
      <span aria-hidden={done ? undefined : 'true'}>
        {committed}
        {animatingGraphemes.map((grapheme, offset) => (
          <span key={animatingOffset + offset} className="g" onAnimationEnd={unwrap}>
            {grapheme}
          </span>
        ))}
        {!done &&
          (stalled ? <StallIndicator reduced={reduced} /> : <Caret idle={!draining && !reduced} />)}
      </span>
      <span style={SR_ONLY} aria-live="polite">
        {announcement}
      </span>
    </div>
  );
}
