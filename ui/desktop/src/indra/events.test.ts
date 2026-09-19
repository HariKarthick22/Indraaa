import { describe, expect, it } from 'vitest';
import { parseIndraEvent } from './events';

describe('parseIndraEvent', () => {
  it('parses a model.selected event with a degraded fit', () => {
    const event = parseIndraEvent({
      t: 'model.selected',
      model_id: 'llama-3.2-vision-11b',
      reason: 'vision required',
      fit: { kind: 'degraded', warning: '6800 MB needed, 5200 MB available' },
    });

    expect(event).toEqual({
      t: 'model.selected',
      model_id: 'llama-3.2-vision-11b',
      reason: 'vision required',
      fit: { kind: 'degraded', warning: '6800 MB needed, 5200 MB available' },
    });
  });

  it('parses an egress.attempt event', () => {
    const event = parseIndraEvent({
      t: 'egress.attempt',
      url: 'https://example.com',
      blocked: true,
      at: '2026-09-16T14:02:31Z',
    });
    expect(event?.t).toBe('egress.attempt');
  });

  it('returns null for an unknown tag rather than throwing', () => {
    expect(parseIndraEvent({ t: 'not.a.real.event' })).toBeNull();
  });

  it('returns null for a non-object', () => {
    expect(parseIndraEvent('nope')).toBeNull();
    expect(parseIndraEvent(null)).toBeNull();
  });
});
