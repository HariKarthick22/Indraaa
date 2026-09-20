import { useMemo } from 'react';
import type { SkillCommand } from '../../indra/skills';
import { fuzzyMatch } from '../../indra/paletteIndex';

export interface SlashMenuProps {
  /** Text typed after `/` in the composer, e.g. `pid` for `/pid-trace`. */
  query: string;
  commands: readonly SkillCommand[];
  onPick: (command: SkillCommand) => void;
}

/**
 * Filtered `/` menu over the installed skills already surfaced by
 * `useSkillCommands`. Matching is name-first via the same fuzzy pass the
 * command palette uses, so `/pid` finds `pid-trace` ahead of any skill whose
 * description merely mentions "pid".
 */
export function SlashMenu({ query, commands, onPick }: SlashMenuProps) {
  const matches = useMemo(
    () => commands.filter((command) => fuzzyMatch(query, command.name) !== null),
    [commands, query]
  );

  if (matches.length === 0) {
    return (
      <div
        role="listbox"
        aria-label="Skill commands"
        style={{
          padding: 'var(--space-4)',
          fontFamily: 'var(--font-ui)',
          fontSize: 'var(--t-12)',
          lineHeight: 'var(--t-12--line-height)',
          color: 'var(--text-faint)',
        }}
      >
        {query.trim() ? `No skills match “${query.trim()}”.` : 'No skills installed.'}
      </div>
    );
  }

  return (
    <div
      role="listbox"
      aria-label="Skill commands"
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
      {matches.map((command) => (
        <button
          key={command.name}
          type="button"
          role="option"
          aria-selected={false}
          onClick={() => onPick(command)}
          style={{
            display: 'flex',
            alignItems: 'baseline',
            gap: 'var(--space-4)',
            minHeight: 32,
            padding: '0 var(--space-4)',
            background: 'transparent',
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
            event.currentTarget.style.background = 'transparent';
          }}
        >
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
            {`/${command.name}`}
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
            {command.description}
          </span>
        </button>
      ))}
    </div>
  );
}
