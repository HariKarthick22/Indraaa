import { useMemo } from 'react';
import { fuzzyMatch } from '../../indra/paletteIndex';

export interface AgentCommand {
  name: string;
  description: string;
}

export interface AgentMenuProps {
  /** Text typed after `//` in the composer, e.g. `rust` for `rust-systems-engineer`. */
  query: string;
  agents: readonly AgentCommand[];
  onPick: (agent: AgentCommand) => void;
  /**
   * Index into the filtered list the composer's Up/Down keys have
   * highlighted. -1 (the default) highlights nothing.
   */
  highlightedIndex?: number;
}

// A diamond with a centered node, not the padlock/pencil/folder shapes this
// design system already uses elsewhere (WorkspaceFolders.tsx) - distinct
// silhouette, not just a distinct colour, so it reads as "agent" at a glance.
const AGENT_GLYPH = (
  <svg width="11" height="11" viewBox="0 0 12 12" aria-hidden="true" focusable="false">
    <path
      d="M6 1.2 10.5 6 6 10.8 1.5 6Z"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.1"
      strokeLinejoin="round"
    />
    <circle cx="6" cy="6" r="1.3" fill="currentColor" />
  </svg>
);

/**
 * Filtered `//` menu over the agents/subagents a turn can be handed to.
 * Modeled closely on SlashMenu.tsx - same fuzzy-filter pass (`fuzzyMatch`),
 * same listbox/option shape, same empty state - but kept as its own
 * component because its rows need a distinct glyph and an `@name` label
 * rather than SlashMenu's `/name`, so the two menus are never mistaken for
 * one another even without relying on colour (spec §8).
 */
export function AgentMenu({ query, agents, onPick, highlightedIndex = -1 }: AgentMenuProps) {
  const matches = useMemo(
    () => agents.filter((agent) => fuzzyMatch(query, agent.name) !== null),
    [agents, query]
  );

  if (matches.length === 0) {
    return (
      <div
        role="listbox"
        aria-label="Agents"
        style={{
          padding: 'var(--space-4)',
          fontFamily: 'var(--font-ui)',
          fontSize: 'var(--t-12)',
          lineHeight: 'var(--t-12--line-height)',
          color: 'var(--text-faint)',
        }}
      >
        {query.trim() ? `No agents match “${query.trim()}”.` : 'No agents installed.'}
      </div>
    );
  }

  return (
    <div
      role="listbox"
      aria-label="Agents"
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 'var(--space-1)',
        padding: 'var(--space-2)',
        background: 'var(--surface)',
        border: '1px solid var(--line)',
        borderRadius: 'var(--r-md)',
        maxHeight: 320,
        overflowY: 'auto',
      }}
    >
      {matches.map((agent, index) => {
        const isActive = index === highlightedIndex;
        return (
          <button
            key={agent.name}
            id={`indra-agent-option-${index}`}
            type="button"
            role="option"
            aria-selected={isActive}
            onClick={() => onPick(agent)}
            className="indra-focusable"
            style={{
              display: 'flex',
              alignItems: 'baseline',
              gap: 'var(--space-4)',
              minHeight: 32,
              padding: '0 var(--space-4)',
              background: isActive ? 'var(--hover)' : 'transparent',
              border: 'none',
              borderRadius: 'var(--r-sm)',
              color: 'var(--text)',
              textAlign: 'left',
              cursor: 'pointer',
            }}
            onMouseEnter={(event) => {
              event.currentTarget.style.background = 'var(--hover)';
            }}
            onMouseLeave={(event) => {
              event.currentTarget.style.background = isActive ? 'var(--hover)' : 'transparent';
            }}
          >
            <span
              aria-hidden="true"
              style={{ flexShrink: 0, display: 'inline-flex', color: 'var(--text-dim)' }}
            >
              {AGENT_GLYPH}
            </span>
            <span
              style={{
                flexShrink: 0,
                fontFamily: 'var(--font-mono)',
                fontSize: 'var(--t-13)',
                lineHeight: 'var(--t-13--line-height)',
                fontWeight: 500,
                color: 'var(--text-hi)',
              }}
            >
              {`@${agent.name}`}
            </span>
            <span
              style={{
                flex: '1 1 auto',
                minWidth: 0,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
                fontSize: 'var(--t-12)',
                lineHeight: 'var(--t-12--line-height)',
                color: 'var(--text-dim)',
              }}
            >
              {agent.description}
            </span>
          </button>
        );
      })}
    </div>
  );
}
