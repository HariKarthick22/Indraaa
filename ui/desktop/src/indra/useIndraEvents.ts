import { useMemo } from 'react';
import { parseIndraEvent, type IndraEvent } from './events';

// crates/indra/src/events/mod.rs writes each event to the operation note
// ("indra", "indra_event"), which lands on message metadata as
// metadata.operations.indra.indra_event — the same shape getSpecialistInfo in
// src/types/message.ts reads for ("specialist", ...).
const NAMESPACE = 'indra';
const KEY = 'indra_event';

/**
 * The minimum a message has to look like to carry an event. `Message` from
 * src/types/message.ts satisfies this structurally, so callers can pass a real
 * message list without a cast.
 */
export interface IndraEventCarrier {
  metadata?: { operations?: Record<string, Record<string, unknown>> | null } | null;
}

/** Reads the raw ("indra", "indra_event") note off one message, if present. */
export function readIndraEventNote(message: IndraEventCarrier): unknown {
  return message?.metadata?.operations?.[NAMESPACE]?.[KEY];
}

/** Extracts the event a single message carries, or null if it carries none. */
export function extractIndraEvent(message: IndraEventCarrier): IndraEvent | null {
  const note = readIndraEventNote(message);
  return note === undefined ? null : parseIndraEvent(note);
}

/**
 * Every event carried by `messages`, in message order. A message with no note,
 * or one whose tag this build does not recognise, is skipped rather than
 * throwing — the UI never invents state it was not sent.
 */
export function useIndraEvents(messages: readonly IndraEventCarrier[]): IndraEvent[] {
  return useMemo(() => {
    const events: IndraEvent[] = [];
    for (const message of messages) {
      const event = extractIndraEvent(message);
      if (event !== null) events.push(event);
    }
    return events;
  }, [messages]);
}
