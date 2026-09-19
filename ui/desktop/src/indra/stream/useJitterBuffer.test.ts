import { describe, expect, it } from 'vitest';
import { drainRate, segmentGraphemes, completeWord } from './useJitterBuffer';

describe('drainRate', () => {
  it('sits at base when the queue is small', () => {
    expect(drainRate(65, 60)).toBeCloseTo(65);
  });

  it('accelerates as the queue grows', () => {
    expect(drainRate(65, 160)).toBeCloseTo(205);
  });

  it('never exceeds 400 chars/sec', () => {
    expect(drainRate(65, 100_000)).toBe(400);
  });

  it('never drops below 60% of base', () => {
    expect(drainRate(65, 0)).toBeCloseTo(39);
  });
});

describe('segmentGraphemes', () => {
  it('keeps an emoji whole', () => {
    expect(segmentGraphemes('a👍b')).toEqual(['a', '👍', 'b']);
  });

  it('keeps a Devanagari conjunct whole', () => {
    expect(segmentGraphemes('क्ष')).toEqual(['क्ष']);
  });
});

describe('completeWord', () => {
  it('extends to the end of the current word', () => {
    expect(completeWord('hello wor', 'ld and more')).toBe('ld');
  });

  it('returns empty when already at a boundary', () => {
    expect(completeWord('hello ', 'world')).toBe('');
  });
});
