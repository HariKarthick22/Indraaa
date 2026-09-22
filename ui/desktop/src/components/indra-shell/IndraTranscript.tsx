import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import type { IndraEvent, SourceBox } from '../../indra/events';
import { CitationChip } from './CitationChip';
import { CompactionDivider, type CompactionDividerProps } from './CompactionDivider';
import { ModelChip, type ModelChipProps } from './ModelChip';
import { PlanCard, type PlanCardProps } from './PlanCard';
import { StreamText } from './StreamText';
import { ToolRow, type ToolCallEvent, type ToolResultEvent } from './ToolRow';
import { planFromEvents, toolCallsFromEvents } from './TraceScreen';

export interface TranscriptTurn {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  events: IndraEvent[];
  streaming?: boolean;
}

export interface IndraTranscriptProps {
  turns: TranscriptTurn[];
  onOpenCitation?: (source: SourceBox) => void;
}

type TurnExtra =
  | { kind: 'plan'; key: string; props: PlanCardProps }
  | { kind: 'tool'; key: string; call: ToolCallEvent; result: ToolResultEvent | null }
  | { kind: 'model'; key: string; props: ModelChipProps }
  | { kind: 'compaction'; key: string; props: CompactionDividerProps };

interface TurnCitation {
  index: number;
  source: SourceBox;
}

interface TurnExtras {
  items: TurnExtra[];
  citations: TurnCitation[];
  lastModelId: string | null;
}

/**
 * Walks a turn's raw event stream once, in order, deriving every inline
 * element the turn needs. Plan and tool-call state come from TraceScreen's
 * own helpers (`planFromEvents`/`toolCallsFromEvents`) rather than a second
 * read of the same events - this file only decides *where in the stream*
 * each derived element belongs.
 */
function extrasFromEvents(events: IndraEvent[], previousModelId: string | null): TurnExtras {
  const plan = planFromEvents(events);
  const toolCalls = toolCallsFromEvents(events);
  const toolByCallId = new Map(toolCalls.map((entry) => [entry.call.call_id, entry]));

  const items: TurnExtra[] = [];
  const citations: TurnCitation[] = [];
  let planEmitted = false;
  let currentModelId = previousModelId;

  events.forEach((event, index) => {
    if (event.t === 'plan.proposed' || event.t === 'plan.revised') {
      if (!planEmitted && plan.steps.length > 0) {
        items.push({ kind: 'plan', key: 'plan', props: plan });
        planEmitted = true;
      }
    } else if (event.t === 'tool.call') {
      const paired = toolByCallId.get(event.call_id);
      if (paired) {
        items.push({ kind: 'tool', key: event.call_id, call: paired.call, result: paired.result });
      }
    } else if (event.t === 'model.selected') {
      items.push({
        kind: 'model',
        key: `model-${index}`,
        props: {
          previousModelId: currentModelId,
          modelId: event.model_id,
          reason: event.reason,
          fit: event.fit,
        },
      });
      currentModelId = event.model_id;
    } else if (event.t === 'context.compacted') {
      items.push({
        kind: 'compaction',
        key: `compaction-${index}`,
        props: {
          fromTurns: event.from_turns,
          toBytes: event.to_bytes,
          // The event reports turns dropped, not kept; every condensed turn is
          // either kept or dropped, so the complement recovers the count the
          // divider wants without inventing data the backend did not send.
          keptCount: Math.max(0, event.from_turns - event.dropped_count),
          droppedCount: event.dropped_count,
          onShow: () => {},
        },
      });
    } else if (event.t === 'citation') {
      citations.push({ index: citations.length + 1, source: event.source });
    }
  });

  return { items, citations, lastModelId: currentModelId };
}

const AUTO_SCROLL_THRESHOLD_PX = 48;

function UserTurn({ text }: { text: string }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 'var(--space-2)' }}>
      <span style={{ fontSize: 'var(--t-11)', lineHeight: 'var(--t-11--line-height)', color: 'var(--text-faint)' }}>
        You
      </span>
      <div
        style={{
          maxWidth: '78ch',
          padding: 'var(--space-4) var(--space-5)',
          border: '1px solid var(--line)',
          borderRadius: 'var(--r-md)',
          background: 'var(--raised)',
          color: 'var(--text)',
          fontFamily: 'var(--font-ui)',
          fontSize: 'var(--t-14)',
          lineHeight: 'var(--t-14--line-height)',
          fontWeight: 400,
          whiteSpace: 'pre-wrap',
          overflowWrap: 'anywhere',
        }}
      >
        {text}
      </div>
    </div>
  );
}

interface AssistantTurnProps {
  turn: TranscriptTurn;
  extras: TurnExtras;
  expandedTools: ReadonlySet<string>;
  onToggleTool: (id: string) => void;
  onOpenCitation?: (source: SourceBox) => void;
}

function AssistantTurn({ turn, extras, expandedTools, onToggleTool, onOpenCitation }: AssistantTurnProps) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
      <StreamText text={turn.text} done={!turn.streaming} />

      {extras.items.map((item) => {
        if (item.kind === 'plan') {
          return <PlanCard key={item.key} {...item.props} />;
        }
        if (item.kind === 'tool') {
          const toolId = `${turn.id}:${item.key}`;
          return (
            <ToolRow
              key={item.key}
              call={item.call}
              result={item.result}
              expanded={expandedTools.has(toolId)}
              onToggle={() => onToggleTool(toolId)}
            />
          );
        }
        if (item.kind === 'model') {
          return <ModelChip key={item.key} {...item.props} />;
        }
        return <CompactionDivider key={item.key} {...item.props} />;
      })}

      {extras.citations.length > 0 ? (
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 'var(--space-3)' }}>
          <span style={{ fontSize: 'var(--t-11)', lineHeight: 'var(--t-11--line-height)', color: 'var(--text-faint)' }}>
            Citations
          </span>
          {extras.citations.map(({ index, source }) => (
            <CitationChip
              key={`${source.doc_id}-${source.page}-${index}`}
              index={index}
              source={source}
              onOpen={onOpenCitation ?? (() => {})}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}

function EmptyState() {
  return (
    <div
      style={{
        maxWidth: '78ch',
        margin: '0 auto',
        border: '1px solid var(--line)',
        borderRadius: 'var(--r-md)',
        background: 'var(--surface)',
        padding: 'var(--space-7)',
        display: 'flex',
        flexDirection: 'column',
        gap: 'var(--space-3)',
        fontFamily: 'var(--font-ui)',
        fontSize: 'var(--t-13)',
        lineHeight: 'var(--t-13--line-height)',
        color: 'var(--text-dim)',
      }}
    >
      <span style={{ color: 'var(--text)', fontWeight: 500 }}>Send a message to start the session</span>
      <span>
        Nothing has been said yet. Once you send a message, INDRA&apos;s reply, plan, and tool calls
        will appear here as they happen.
      </span>
    </div>
  );
}

const jumpButtonStyle: CSSProperties = {
  position: 'absolute',
  left: '50%',
  bottom: 'var(--space-6)',
  transform: 'translateX(-50%)',
  display: 'inline-flex',
  alignItems: 'center',
  gap: 'var(--space-2)',
  height: 30,
  padding: '0 var(--space-5)',
  background: 'var(--raised)',
  border: '1px solid var(--line-strong)',
  borderRadius: 'var(--r-full)',
  color: 'var(--text-hi)',
  fontFamily: 'var(--font-ui)',
  fontSize: 'var(--t-12)',
  fontWeight: 500,
  cursor: 'pointer',
};

/**
 * Spec: the scrolling conversation view. Auto-follows the bottom while
 * content streams in, but the instant the user scrolls away from the bottom
 * (e.g. to read back through the transcript) it stops fighting them - and
 * resumes the moment they scroll back down themselves, or press "Jump to
 * latest".
 */
export function IndraTranscript({ turns, onOpenCitation }: IndraTranscriptProps) {
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const [pinned, setPinned] = useState(true);
  const [expandedTools, setExpandedTools] = useState<ReadonlySet<string>>(new Set());

  const toggleTool = (id: string) => {
    setExpandedTools((current) => {
      const next = new Set(current);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const scrollToBottom = () => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  };

  const handleScroll = () => {
    const el = scrollRef.current;
    if (!el) return;
    const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
    setPinned(distanceFromBottom <= AUTO_SCROLL_THRESHOLD_PX);
  };

  const handleJumpToLatest = () => {
    setPinned(true);
    scrollToBottom();
  };

  // Follows new turns and growing streamed text while pinned. Content that
  // grows purely inside StreamText's own per-glyph reveal (no new turn, same
  // string) is caught by the ResizeObserver below rather than this effect.
  useEffect(() => {
    if (pinned) scrollToBottom();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [turns]);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el || typeof ResizeObserver === 'undefined') return undefined;
    const observer = new ResizeObserver(() => {
      if (pinned) scrollToBottom();
    });
    observer.observe(el);
    return () => observer.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pinned]);

  const turnExtras = useMemo(() => {
    let modelId: string | null = null;
    return turns.map((turn) => {
      const extras = extrasFromEvents(turn.events, modelId);
      modelId = extras.lastModelId;
      return extras;
    });
  }, [turns]);

  if (turns.length === 0) {
    return <EmptyState />;
  }

  return (
    <div style={{ position: 'relative', height: '100%', minHeight: 0, display: 'flex', flexDirection: 'column' }}>
      <div
        ref={scrollRef}
        onScroll={handleScroll}
        data-testid="indra-transcript-scroll"
        aria-label="Conversation"
        style={{ flex: '1 1 auto', minHeight: 0, overflowY: 'auto' }}
      >
        <div
          style={{
            width: '100%',
            maxWidth: '78ch',
            margin: '0 auto',
            display: 'flex',
            flexDirection: 'column',
            gap: 'var(--space-7)',
            padding: 'var(--space-6) 0',
          }}
        >
          {turns.map((turn, index) =>
            turn.role === 'user' ? (
              <div key={turn.id} data-testid={`indra-turn-${turn.id}`} data-turn-role="user">
                <UserTurn text={turn.text} />
              </div>
            ) : (
              <div key={turn.id} data-testid={`indra-turn-${turn.id}`} data-turn-role="assistant">
                <AssistantTurn
                  turn={turn}
                  extras={turnExtras[index]}
                  expandedTools={expandedTools}
                  onToggleTool={toggleTool}
                  onOpenCitation={onOpenCitation}
                />
              </div>
            )
          )}
        </div>
      </div>

      {!pinned ? (
        <button
          type="button"
          onClick={handleJumpToLatest}
          className="indra-focusable indra-rise"
          style={jumpButtonStyle}
        >
          <span aria-hidden="true">{'↓'}</span>
          Jump to latest
        </button>
      ) : null}
    </div>
  );
}
