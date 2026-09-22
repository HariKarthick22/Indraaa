import { useMemo } from 'react';
import { ChatState } from '../types/chatState';
import type { Message } from '../types/message';
import { extractIndraEvent } from './useIndraEvents';
import type { TranscriptTurn } from '../components/indra-shell/IndraTranscript';

function textOf(message: Message): string {
  return message.content
    .filter((c): c is Extract<Message['content'][number], { type: 'text' }> => c.type === 'text')
    .map((c) => c.text)
    .join('');
}

/**
 * A visual turn in IndraTranscript is not one `Message` — the backend emits a
 * separate message per IndraEvent (`useIndraEvents`' own doc comment: "the
 * event a single message carries"), so a real assistant reply is several
 * consecutive same-role messages. This groups them, concatenating text and
 * collecting each message's event (if any) into that turn's `events` array,
 * in message order — matching the order IndraTranscript already expects from
 * TraceScreen's `planFromEvents`/`toolCallsFromEvents` helpers.
 */
export function useTranscriptTurns(messages: readonly Message[], chatState: ChatState): TranscriptTurn[] {
  return useMemo(() => {
    const turns: TranscriptTurn[] = [];

    for (const message of messages) {
      const event = extractIndraEvent(message);
      const text = textOf(message);
      const last = turns[turns.length - 1];

      if (last && last.role === message.role) {
        last.text += text;
        if (event) last.events.push(event);
      } else {
        turns.push({
          id: message.id ?? `${message.role}-${message.created}-${turns.length}`,
          role: message.role,
          text,
          events: event ? [event] : [],
        });
      }
    }

    const lastTurn = turns[turns.length - 1];
    if (
      lastTurn &&
      lastTurn.role === 'assistant' &&
      (chatState === ChatState.Streaming || chatState === ChatState.Thinking)
    ) {
      lastTurn.streaming = true;
    }

    return turns;
  }, [messages, chatState]);
}
