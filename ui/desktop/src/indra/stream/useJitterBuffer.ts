import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useReducedMotion } from '../useReducedMotion';

const MAX_RATE = 400;

export function drainRate(base: number, queueLength: number): number {
  const target = base + (queueLength - 60) * 1.4;
  return Math.min(Math.max(target, base * 0.6), MAX_RATE);
}

const segmenter = new Intl.Segmenter(undefined, { granularity: 'grapheme' });

export function segmentGraphemes(text: string): string[] {
  return Array.from(segmenter.segment(text), (s) => s.segment);
}

// When the queue empties mid-word, the remaining characters of that word commit
// immediately — a word half-drawn at rest reads as a rendering bug.
export function completeWord(committed: string, remaining: string): string {
  if (committed.length === 0 || /\s$/.test(committed)) return '';
  const boundary = remaining.search(/\s/);
  return boundary === -1 ? remaining : remaining.slice(0, boundary);
}

/* ── the buffer ─────────────────────────────────────────────────────────── */

// Spec §3.6: Calm 45 · Normal 65 · Instant ∞.
export const SPEED_BASE = { calm: 45, normal: 65, instant: Number.POSITIVE_INFINITY } as const;
export type StreamSpeedName = keyof typeof SPEED_BASE;
export type StreamSpeed = StreamSpeedName | number;

// Spec §6.1: a stall of >900 ms swaps the caret for a breathing indicator.
export const STALL_MS = 900;

// Only the ~120 graphemes still animating are live DOM nodes; everything older
// is plain text. A 4,000-word answer must not be 20,000 spans.
export const MAX_ANIMATING = 120;

// The drain is continuous, so a half-drawn word normally lives for one frame.
// This is the backstop for the sub-one-grapheme-per-frame case near the floor
// rate: once nothing has been revealed for this long, flush to a word boundary.
const IDLE_FLUSH_MS = 150;

export interface JitterBufferOptions {
  /** The whole text received so far. Deltas are appended by the caller. */
  text: string;
  speed?: StreamSpeed;
  /** The turn has ended — no further deltas will arrive. */
  done?: boolean;
}

export interface JitterBufferState {
  /** Settled text. Rendered as one plain text node. */
  committed: string;
  /** The tail still running its entrance animation. */
  animating: string;
  /** The same tail, one entry per grapheme cluster, for span wrapping. */
  animatingGraphemes: string[];
  /** Absolute grapheme index of the first animating cluster — stable span keys. */
  animatingOffset: number;
  /** No delta has arrived for STALL_MS and the turn has not ended. */
  stalled: boolean;
  /** Graphemes are still being revealed. */
  draining: boolean;
  /** Called on `animationend` to unwrap a span back into plain text. */
  settle: (count: number) => void;
}

interface SegmentCache {
  source: string;
  graphemes: string[];
}

// Re-segmenting the whole buffer on every delta is O(n) per delta. Segment only
// the appended chunk — but from the start of the last known cluster, because an
// appended combining mark or ZWJ joins the cluster before it.
function resegment(cache: SegmentCache, text: string): SegmentCache {
  if (text === cache.source) return cache;
  if (cache.source.length > 0 && text.startsWith(cache.source)) {
    const kept = cache.graphemes.slice(0, -1);
    const head = kept.join('');
    return { source: text, graphemes: kept.concat(segmentGraphemes(text.slice(head.length))) };
  }
  return { source: text, graphemes: segmentGraphemes(text) };
}

/** How many leading graphemes of `graphemes` cover `chars` characters. */
function graphemesForChars(graphemes: string[], chars: number): number {
  let count = 0;
  let length = 0;
  while (count < graphemes.length && length < chars) {
    length += graphemes[count].length;
    count += 1;
  }
  return count;
}

// Reduced motion commits per word, instantly. The trailing partial word waits
// so nothing is ever half-drawn.
function wordSafeLength(text: string, done: boolean): number {
  if (done) return text.length;
  const partial = text.search(/\S+$/);
  return partial === -1 ? text.length : partial;
}

export function useJitterBuffer({
  text,
  speed = 'normal',
  done = false,
}: JitterBufferOptions): JitterBufferState {
  const reduced = useReducedMotion();
  const base = typeof speed === 'number' ? speed : SPEED_BASE[speed];
  const instant = !Number.isFinite(base);
  const immediate = instant || reduced;

  const cacheRef = useRef<SegmentCache>({ source: '', graphemes: [] });
  const graphemes = useMemo(() => {
    cacheRef.current = resegment(cacheRef.current, text);
    return cacheRef.current.graphemes;
  }, [text]);
  const total = graphemes.length;

  const graphemesRef = useRef(graphemes);
  graphemesRef.current = graphemes;

  const [revealed, setRevealed] = useState(0);
  const [settled, setSettled] = useState(0);
  const [stalled, setStalled] = useState(false);

  // A replaced (rather than appended) buffer is a new message: start over.
  const sourceRef = useRef('');
  useEffect(() => {
    if (!text.startsWith(sourceRef.current)) {
      setRevealed(0);
      setSettled(0);
    }
    sourceRef.current = text;
  }, [text]);

  // The rAF drain.
  useEffect(() => {
    if (immediate) return;
    let frame = 0;
    let last = performance.now();
    let carry = 0;

    const tick = (now: number) => {
      frame = requestAnimationFrame(tick);
      // A backgrounded window hands us a multi-second delta on return; clamp it
      // so the buffer does not dump a paragraph in a single frame.
      const dt = Math.min((now - last) / 1000, 0.25);
      last = now;

      setRevealed((current) => {
        const queue = graphemesRef.current.length - current;
        if (queue <= 0) {
          carry = 0;
          return current;
        }
        carry += drainRate(base, queue) * dt;
        const whole = Math.floor(carry);
        if (whole <= 0) return current;
        carry -= whole;
        return current + Math.min(whole, queue);
      });
    };

    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [base, immediate]);

  // Word-boundary backstop (see IDLE_FLUSH_MS).
  useEffect(() => {
    if (immediate) return;
    const timer = window.setTimeout(() => {
      setRevealed((current) => {
        const all = graphemesRef.current;
        if (current >= all.length) return current;
        const rest = all.slice(current);
        const tail = completeWord(all.slice(0, current).join(''), rest.join(''));
        if (tail.length === 0) return current;
        return current + graphemesForChars(rest, tail.length);
      });
    }, IDLE_FLUSH_MS);
    return () => window.clearTimeout(timer);
  }, [text, revealed, immediate]);

  // Stall is measured on deltas, not on the drain: the caret means "the model
  // is still talking", not "the buffer is still emptying".
  useEffect(() => {
    setStalled(false);
    if (done) return;
    const timer = window.setTimeout(() => setStalled(true), STALL_MS);
    return () => window.clearTimeout(timer);
  }, [text, done]);

  const settle = useCallback((count: number) => {
    setSettled((current) => current + count);
  }, []);

  // Instant is ∞ chars/sec: everything received is on screen. Reduced motion
  // commits per word, so the trailing partial word waits for its remainder.
  let shown: number;
  if (instant) {
    shown = total;
  } else if (reduced) {
    shown = graphemesForChars(graphemes, wordSafeLength(text, done));
  } else {
    shown = Math.min(revealed, total);
  }
  const floor = Math.max(0, shown - MAX_ANIMATING);
  const animatingOffset = immediate ? shown : Math.min(Math.max(settled, floor), shown);
  const animatingGraphemes = graphemes.slice(animatingOffset, shown);

  return {
    committed: graphemes.slice(0, animatingOffset).join(''),
    animating: animatingGraphemes.join(''),
    animatingGraphemes,
    animatingOffset,
    stalled: stalled && !done,
    draining: shown < total,
    settle,
  };
}
