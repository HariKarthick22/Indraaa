import { renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { useIndraEvents, type IndraEventCarrier } from './useIndraEvents';
import type { IndraEvent } from './events';

function messageWith(event: unknown): IndraEventCarrier {
  return { metadata: { operations: { indra: { indra_event: event } } } };
}

describe('useIndraEvents', () => {
  it('returns one event per message, in message order', () => {
    const messages = [
      messageWith({ t: 'context.delta', session_bytes: 100, budget_bytes: 32768 }),
      messageWith({
        t: 'egress.attempt',
        url: 'https://example.com',
        blocked: true,
        at: '2026-09-16T14:02:31Z',
      }),
    ];

    const { result } = renderHook(() => useIndraEvents(messages));

    expect(result.current.map((e: IndraEvent) => e.t)).toEqual([
      'context.delta',
      'egress.attempt',
    ]);
  });

  it('skips messages with no indra operation note and unrecognised events', () => {
    const messages: IndraEventCarrier[] = [
      {},
      { metadata: { operations: { specialist: { specialist_name: 'hydraulics' } } } },
      messageWith({ t: 'not.a.real.event' }),
      messageWith({ t: 'guard.blocked', resource: 'P-101.pdf', reason: 'sealed' }),
    ];

    const { result } = renderHook(() => useIndraEvents(messages));

    expect(result.current).toEqual([
      { t: 'guard.blocked', resource: 'P-101.pdf', reason: 'sealed' },
    ]);
  });

  it('returns a stable array when the message list does not change', () => {
    const messages = [messageWith({ t: 'context.delta', session_bytes: 1, budget_bytes: 2 })];
    const { result, rerender } = renderHook(() => useIndraEvents(messages));
    const first = result.current;
    rerender();
    expect(result.current).toBe(first);
  });
});
