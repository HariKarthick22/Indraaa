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
