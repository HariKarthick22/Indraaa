import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { CSSProperties, KeyboardEvent } from 'react';
import { searchPalette, type PaletteEntry } from '../../indra/paletteIndex';
import { useReducedMotion } from '../../indra/useReducedMotion';

export interface CommandPaletteProps {
  open: boolean;
  entries: readonly PaletteEntry[];
  onClose: () => void;
  /** Overrides the default search placeholder. */
  placeholder?: string;
}

const LIST_ID = 'indra-palette-list';
const OPEN_MS = 120;

function optionId(entryId: string): string {
  return `indra-palette-option-${entryId}`;
}

const backdropStyle: CSSProperties = {
  position: 'fixed',
  inset: 0,
  // Spec §7.1: the palette opens in 120 ms with no backdrop animation. A
  // scrim that fades in makes the palette feel slower than it is.
  background: 'rgba(0, 0, 0, 0.44)',
  transition: 'none',
  animation: 'none',
};

const kindStyle: CSSProperties = {
  flexShrink: 0,
  fontFamily: 'var(--font-mono)',
  fontSize: 'var(--t-11)',
  lineHeight: 'var(--t-11--line-height)',
  color: 'var(--text-faint)',
};

export function CommandPalette({ open, entries, onClose, placeholder }: CommandPaletteProps) {
  const [query, setQuery] = useState('');
  const [highlight, setHighlight] = useState(0);
  const [focusRing, setFocusRing] = useState(false);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const reducedMotion = useReducedMotion();

  const matches = useMemo(() => searchPalette(entries, query), [entries, query]);
  const active = matches[highlight];

  useEffect(() => {
    if (!open) return;
    setQuery('');
    setHighlight(0);
    inputRef.current?.focus();
  }, [open]);

  const runEntry = useCallback(
    (entry: PaletteEntry | undefined) => {
      if (!entry) return;
      entry.run();
      onClose();
    },
    [onClose]
  );

  const onKeyDown = useCallback(
    (event: KeyboardEvent<HTMLDivElement>) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onClose();
        return;
      }
      if (event.key === 'ArrowDown') {
        event.preventDefault();
        if (matches.length > 0) setHighlight((index) => (index + 1) % matches.length);
        return;
      }
      if (event.key === 'ArrowUp') {
        event.preventDefault();
        if (matches.length > 0) {
          setHighlight((index) => (index - 1 + matches.length) % matches.length);
        }
        return;
      }
      if (event.key === 'Enter') {
        event.preventDefault();
        runEntry(active?.entry);
      }
    },
    [active, matches.length, onClose, runEntry]
  );

  if (!open) return null;

  return (
    <>
      <div data-testid="indra-palette-backdrop" style={backdropStyle} onClick={onClose} />
      <div
        style={{
          position: 'fixed',
          inset: 0,
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'flex-start',
          paddingTop: 'var(--space-10)',
          pointerEvents: 'none',
        }}
      >
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Command palette"
          onKeyDown={onKeyDown}
          style={{
            pointerEvents: 'auto',
            width: 560,
            maxWidth: 'calc(100vw - 64px)',
            display: 'flex',
            flexDirection: 'column',
            background: 'var(--surface)',
            border: '1px solid var(--line)',
            borderRadius: 'var(--r-md)',
            // The palette and dialogs are the only surfaces permitted to lift
            // off the canvas (§3.4). Everywhere else borders do this work.
            boxShadow: 'var(--shadow-pop)',
            color: 'var(--text)',
            fontFamily: 'var(--font-ui)',
            opacity: 1,
            transitionProperty: 'opacity, transform',
            transitionDuration: reducedMotion ? '0ms' : `${OPEN_MS}ms`,
            transitionTimingFunction: 'var(--ease-enter)',
            overflow: 'hidden',
          }}
        >
          <input
            ref={inputRef}
            type="text"
            role="combobox"
            aria-expanded="true"
            aria-controls={LIST_ID}
            aria-autocomplete="list"
            aria-activedescendant={active ? optionId(active.entry.id) : undefined}
            aria-label="Search commands"
            value={query}
            placeholder={placeholder ?? 'Search destinations, sessions, documents, skills'}
            onChange={(event) => {
              setQuery(event.target.value);
              setHighlight(0);
            }}
            onFocus={() => setFocusRing(true)}
            onBlur={() => setFocusRing(false)}
            style={{
              height: 44,
              flexShrink: 0,
              padding: '0 var(--space-5)',
              background: 'transparent',
              border: 'none',
              borderBottom: '1px solid var(--line)',
              color: 'var(--text-hi)',
              // --focus lives on exactly two things: this caret and the ring
              // around this field (§3.2).
              caretColor: 'var(--focus)',
              fontFamily: 'var(--font-ui)',
              fontSize: 'var(--t-14)',
              lineHeight: 'var(--t-14--line-height)',
              outline: focusRing ? '2px solid var(--focus)' : 'none',
              outlineOffset: '2px',
            }}
          />

          {matches.length > 0 ? (
            <ul
              id={LIST_ID}
              role="listbox"
              aria-label="Commands"
              style={{
                listStyle: 'none',
                margin: 0,
                padding: 'var(--space-2)',
                maxHeight: 320,
                overflowY: 'auto',
              }}
            >
              {matches.map((match, index) => {
                const isActive = index === highlight;
                return (
                  <li
                    key={match.entry.id}
                    id={optionId(match.entry.id)}
                    role="option"
                    aria-selected={isActive}
                    onMouseMove={() => setHighlight(index)}
                    onClick={() => runEntry(match.entry)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 'var(--space-4)',
                      minHeight: 32,
                      padding: '0 var(--space-4)',
                      borderRadius: 'var(--r-sm)',
                      background: isActive ? 'var(--hover)' : 'transparent',
                      color: isActive ? 'var(--text-hi)' : 'var(--text)',
                      cursor: 'pointer',
                    }}
                  >
                    <span
                      style={{
                        flexShrink: 0,
                        fontFamily:
                          match.entry.kind === 'skill' ? 'var(--font-mono)' : 'var(--font-ui)',
                        fontSize: 'var(--t-13)',
                        lineHeight: 'var(--t-13--line-height)',
                        fontWeight: isActive ? 500 : 400,
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {match.entry.label}
                    </span>
                    {match.entry.hint ? (
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
                        {match.entry.hint}
                      </span>
                    ) : (
                      <span style={{ flex: '1 1 auto' }} />
                    )}
                    <span style={kindStyle}>{match.entry.kind}</span>
                  </li>
                );
              })}
            </ul>
          ) : (
            // Empty states name the next action and never carry an
            // illustration (§7.1).
            <div
              style={{
                padding: 'var(--space-5)',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'flex-start',
                gap: 'var(--space-4)',
              }}
            >
              <p
                style={{
                  margin: 0,
                  fontSize: 'var(--t-13)',
                  lineHeight: 'var(--t-13--line-height)',
                  color: 'var(--text-dim)',
                }}
              >
                {`No matches for “${query.trim()}”.`}
              </p>
              <button
                type="button"
                onClick={() => {
                  setQuery('');
                  setHighlight(0);
                  inputRef.current?.focus();
                }}
                className="indra-focusable"
                style={{
                  height: 28,
                  padding: '0 var(--space-4)',
                  background: 'transparent',
                  border: '1px solid var(--line)',
                  borderRadius: 'var(--r-sm)',
                  color: 'var(--text)',
                  fontFamily: 'var(--font-ui)',
                  fontSize: 'var(--t-12)',
                  cursor: 'pointer',
                }}
              >
                Clear the search
              </button>
            </div>
          )}

          <div
            style={{
              flexShrink: 0,
              display: 'flex',
              gap: 'var(--space-5)',
              padding: 'var(--space-2) var(--space-5)',
              borderTop: '1px solid var(--line)',
              fontSize: 'var(--t-11)',
              lineHeight: 'var(--t-11--line-height)',
              color: 'var(--text-faint)',
            }}
          >
            <span>Up and down to move</span>
            <span>Enter to run</span>
            <span>Esc to close</span>
          </div>
        </div>
      </div>
    </>
  );
}
