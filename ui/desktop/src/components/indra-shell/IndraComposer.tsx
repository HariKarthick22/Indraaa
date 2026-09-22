import {
  useCallback,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type CSSProperties,
  type KeyboardEvent,
  type ReactNode,
} from 'react';
import { fuzzyMatch } from '../../indra/paletteIndex';
import type { SkillCommand } from '../../indra/skills';
import { AgentMenu, type AgentCommand } from './AgentMenu';
import { SlashMenu } from './SlashMenu';

export type PermissionMode = 'auto' | 'manual';

export interface IndraComposerProps {
  value: string;
  onChange: (value: string) => void;
  onSubmit: (value: string) => void;
  skills: { name: string; description: string }[];
  agents: { name: string; description: string }[];
  modelName?: string;
  workspaceLabel?: string;
  permissionMode: PermissionMode;
  onPermissionModeChange: (mode: PermissionMode) => void;
  disabled?: boolean;
}

type MenuKind = 'skills' | 'agents' | null;

interface TriggerState {
  kind: MenuKind;
  /** Text after the trigger's slash(es), e.g. `pid` for a `/pid` token. */
  query: string;
  /** Index in `value` where the trigger token (its leading slash(es)) starts. */
  tokenStart: number;
  /** Caret position `detectTrigger` was computed at - also the token's end. */
  caret: number;
}

// A stable singleton, not a fresh object literal, so a keystroke that stays
// outside any trigger (ordinary typing) returns the same reference every
// time - React's Object.is bail-out then skips the re-render entirely
// instead of committing a no-op state update on every character.
const NO_TRIGGER: TriggerState = { kind: null, query: '', tokenStart: -1, caret: -1 };

const MAX_TEXTAREA_HEIGHT_PX = 240;

/**
 * Reads the trigger off the run of non-whitespace characters immediately
 * before the caret (the "current token"). Because that token is always
 * bounded by whitespace or the start of the text, a `/` that shows up after
 * other characters in the same word - `abc/def` - is never at the token's
 * start and so never triggers; this is what makes "`/` at the start of
 * input or after whitespace" true without a separate start-of-string case.
 *
 * A token of exactly `//...` (two slashes) reads as the agents trigger, one
 * leading slash reads as skills, so the two are mutually exclusive by
 * construction - there is no state where both could be considered "open".
 */
function detectTrigger(value: string, caret: number): TriggerState {
  const safeCaret = Math.max(0, Math.min(caret, value.length));
  const before = value.slice(0, safeCaret);
  let tokenStart = safeCaret;
  while (tokenStart > 0 && !/\s/.test(before[tokenStart - 1])) {
    tokenStart -= 1;
  }
  const token = before.slice(tokenStart);

  if (token.startsWith('//')) {
    return { kind: 'agents', query: token.slice(2), tokenStart, caret: safeCaret };
  }
  if (token.startsWith('/')) {
    return { kind: 'skills', query: token.slice(1), tokenStart, caret: safeCaret };
  }
  return NO_TRIGGER;
}

const MODEL_GLYPH = (
  <svg width="11" height="11" viewBox="0 0 12 12" aria-hidden="true" focusable="false">
    <rect
      x="3"
      y="3"
      width="6"
      height="6"
      rx="1"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.1"
    />
    <path
      d="M6 1.2V3M6 9v1.8M1.2 6H3M9 6h1.8"
      stroke="currentColor"
      strokeWidth="1.1"
      strokeLinecap="round"
    />
  </svg>
);

// The same closed-folder silhouette WorkspaceFolders.tsx uses for its
// "selected folders" scope - kept local rather than imported since that
// file doesn't export its glyphs, but deliberately the same shape so a
// folder reads as "folder" consistently across the app.
const WORKSPACE_GLYPH = (
  <svg width="11" height="11" viewBox="0 0 12 12" aria-hidden="true" focusable="false">
    <path
      d="M1.5 3.4h3.1l1 1.1h5v5.6h-9.1Z"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.1"
      strokeLinejoin="round"
    />
  </svg>
);

const AUTO_GLYPH = (
  <svg width="11" height="11" viewBox="0 0 12 12" aria-hidden="true" focusable="false">
    <path d="M3 2.2 9.6 6 3 9.8Z" fill="currentColor" />
  </svg>
);

const MANUAL_GLYPH = (
  <svg width="11" height="11" viewBox="0 0 12 12" aria-hidden="true" focusable="false">
    <rect
      x="1.5"
      y="1.5"
      width="9"
      height="9"
      rx="1.5"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.1"
    />
    <path
      d="M3.4 6.1 5.2 7.9 8.6 4.3"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

const PERMISSION_LABEL: Record<PermissionMode, string> = { auto: 'Auto', manual: 'Manual' };
const PERMISSION_GLYPH: Record<PermissionMode, ReactNode> = {
  auto: AUTO_GLYPH,
  manual: MANUAL_GLYPH,
};

// Signal colour per the achromatic rule (spec 3.2/8), matching
// WorkspaceFolders.tsx's exact mapping for the same kind of choice: sealed
// green for the mode where nothing proceeds without a human, degraded amber
// for the mode that trades that check for speed. Colour is never the only
// signal - the glyph and label above always carry the same fact.
const PERMISSION_COLOR: Record<PermissionMode, string> = {
  auto: 'var(--degraded)',
  manual: 'var(--sealed)',
};

const PERMISSION_DESCRIPTION: Record<PermissionMode, string> = {
  auto: 'INDRA acts without asking first. Every action still appears in the transcript, but nothing waits for your approval.',
  manual: 'INDRA proposes every action and waits for your approval before it runs.',
};

interface PermissionToggleProps {
  mode: PermissionMode;
  onChange: (mode: PermissionMode) => void;
}

function PermissionToggle({ mode, onChange }: PermissionToggleProps) {
  const other: PermissionMode = mode === 'auto' ? 'manual' : 'auto';
  const color = PERMISSION_COLOR[mode];

  return (
    <button
      type="button"
      className="indra-focusable"
      title={PERMISSION_DESCRIPTION[mode]}
      aria-label={`Permission mode: ${PERMISSION_LABEL[mode]}. Click to switch to ${PERMISSION_LABEL[other]}.`}
      onClick={() => onChange(other)}
      style={{
        flexShrink: 0,
        display: 'inline-flex',
        alignItems: 'center',
        gap: 'var(--space-2)',
        height: 22,
        padding: '0 var(--space-3)',
        background: 'transparent',
        border: `1px solid ${color}`,
        borderRadius: 'var(--r-sm)',
        color,
        fontFamily: 'var(--font-ui)',
        fontSize: 'var(--t-11)',
        lineHeight: 'var(--t-11--line-height)',
        fontWeight: 500,
        cursor: 'pointer',
      }}
    >
      <span aria-hidden="true" style={{ display: 'inline-flex', flexShrink: 0 }}>
        {PERMISSION_GLYPH[mode]}
      </span>
      {PERMISSION_LABEL[mode]}
    </button>
  );
}

const statusItem: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 'var(--space-2)',
  minWidth: 0,
};

const statusText: CSSProperties = {
  fontSize: 'var(--t-11)',
  lineHeight: 'var(--t-11--line-height)',
  color: 'var(--text-dim)',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
};

interface StatusRowProps {
  modelName?: string;
  workspaceLabel?: string;
  permissionMode: PermissionMode;
  onPermissionModeChange: (mode: PermissionMode) => void;
}

// The compact strip beneath the textarea - model, workspace scope, and the
// permission toggle - mirroring how Claude Code's status line always shows
// where and how it's about to act, right under the input.
function StatusRow({
  modelName,
  workspaceLabel,
  permissionMode,
  onPermissionModeChange,
}: StatusRowProps) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: 'var(--space-4)',
        padding: 'var(--space-2) var(--space-4)',
        borderTop: '1px solid var(--line)',
        fontFamily: 'var(--font-ui)',
      }}
    >
      <span style={statusItem}>
        <span aria-hidden="true" style={{ color: 'var(--text-faint)', display: 'inline-flex' }}>
          {MODEL_GLYPH}
        </span>
        <span style={{ ...statusText, fontFamily: 'var(--font-mono)' }}>
          {modelName ?? 'No model selected'}
        </span>
      </span>

      <span aria-hidden="true" style={{ color: 'var(--text-faint)', fontSize: 'var(--t-11)' }}>
        {'·'}
      </span>

      <span style={statusItem}>
        <span aria-hidden="true" style={{ color: 'var(--text-faint)', display: 'inline-flex' }}>
          {WORKSPACE_GLYPH}
        </span>
        <span style={statusText}>{workspaceLabel ?? 'No workspace scope set'}</span>
      </span>

      <span style={{ flex: '1 1 auto' }} />

      <PermissionToggle mode={permissionMode} onChange={onPermissionModeChange} />
    </div>
  );
}

const popoverStyle: CSSProperties = {
  position: 'absolute',
  left: 0,
  right: 0,
  bottom: '100%',
  marginBottom: 'var(--space-2)',
  zIndex: 20,
};

/**
 * The input surface: a multi-line auto-growing textarea with a `/`-triggered
 * skills menu, a `//`-triggered agents menu, and a compact status row for
 * the active model, workspace scope, and permission mode. `--r-lg` is used
 * exactly once in this file (the outer card below) - the one place this
 * design system uses that radius.
 */
export function IndraComposer({
  value,
  onChange,
  onSubmit,
  skills,
  agents,
  modelName,
  workspaceLabel,
  permissionMode,
  onPermissionModeChange,
  disabled = false,
}: IndraComposerProps) {
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const pendingCaretRef = useRef<number | null>(null);
  // Mirrors `trigger` state without waiting for a render, so applyPick and
  // the dismissed-reset check below always compare against the value that
  // was actually last computed, not a stale render's closure.
  const triggerRef = useRef<TriggerState>(NO_TRIGGER);

  const [trigger, setTrigger] = useState<TriggerState>(NO_TRIGGER);
  // Esc closes the menu for the token being typed without touching `value`;
  // it stays closed until the token itself changes (see syncTrigger).
  const [dismissed, setDismissed] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(0);

  const menuOpen = trigger.kind !== null && !dismissed;

  const filteredSkills = useMemo(
    () =>
      trigger.kind === 'skills'
        ? skills.filter((skill) => fuzzyMatch(trigger.query, skill.name) !== null)
        : [],
    [skills, trigger.kind, trigger.query]
  );
  const filteredAgents = useMemo(
    () =>
      trigger.kind === 'agents'
        ? agents.filter((agent) => fuzzyMatch(trigger.query, agent.name) !== null)
        : [],
    [agents, trigger.kind, trigger.query]
  );
  const activeLength =
    trigger.kind === 'skills'
      ? filteredSkills.length
      : trigger.kind === 'agents'
        ? filteredAgents.length
        : 0;

  const syncTrigger = useCallback((text: string, caret: number) => {
    const info = detectTrigger(text, caret);
    const previous = triggerRef.current;
    // Un-dismiss on a genuinely new trigger context: the token moved (a
    // fresh `/` after whitespace) or its kind changed (a second `/` turning
    // skills into agents). Esc otherwise stays sticky while the same token
    // keeps being edited, matching how Slack/Notion-style slash menus behave.
    if (
      info.kind === null ||
      previous.kind !== info.kind ||
      previous.tokenStart !== info.tokenStart
    ) {
      setDismissed(false);
    }
    triggerRef.current = info;
    setTrigger(info);
    setHighlightedIndex(0);
  }, []);

  const applyPick = useCallback(
    (insertText: string) => {
      const current = triggerRef.current;
      if (current.kind === null) return;
      const before = value.slice(0, current.tokenStart);
      const after = value.slice(current.caret);
      pendingCaretRef.current = before.length + insertText.length;
      triggerRef.current = NO_TRIGGER;
      setTrigger(NO_TRIGGER);
      setDismissed(false);
      setHighlightedIndex(0);
      onChange(`${before}${insertText}${after}`);
    },
    [value, onChange]
  );

  const pickSkill = useCallback((skill: SkillCommand) => applyPick(`/${skill.name} `), [applyPick]);
  const pickAgent = useCallback((agent: AgentCommand) => applyPick(`@${agent.name} `), [applyPick]);

  const pickHighlighted = useCallback(() => {
    if (trigger.kind === 'skills') {
      const skill = filteredSkills[highlightedIndex];
      if (skill) pickSkill(skill);
    } else if (trigger.kind === 'agents') {
      const agent = filteredAgents[highlightedIndex];
      if (agent) pickAgent(agent);
    }
  }, [trigger.kind, filteredSkills, filteredAgents, highlightedIndex, pickSkill, pickAgent]);

  const submit = useCallback(() => {
    if (disabled) return;
    if (value.trim().length === 0) return;
    onSubmit(value);
  }, [disabled, value, onSubmit]);

  const handleChange = useCallback(
    (event: ChangeEvent<HTMLTextAreaElement>) => {
      const target = event.target;
      onChange(target.value);
      syncTrigger(target.value, target.selectionStart ?? target.value.length);
    },
    [onChange, syncTrigger]
  );

  const handleKeyDown = useCallback(
    (event: KeyboardEvent<HTMLTextAreaElement>) => {
      if (menuOpen) {
        if (event.key === 'ArrowDown') {
          event.preventDefault();
          event.stopPropagation();
          if (activeLength > 0) setHighlightedIndex((index) => (index + 1) % activeLength);
          return;
        }
        if (event.key === 'ArrowUp') {
          event.preventDefault();
          event.stopPropagation();
          if (activeLength > 0)
            setHighlightedIndex((index) => (index - 1 + activeLength) % activeLength);
          return;
        }
        if (event.key === 'Enter' && !event.shiftKey) {
          event.preventDefault();
          event.stopPropagation();
          pickHighlighted();
          return;
        }
        if (event.key === 'Escape') {
          event.preventDefault();
          event.stopPropagation();
          setDismissed(true);
          return;
        }
      }

      if (event.key === 'Enter' && !event.shiftKey) {
        event.preventDefault();
        submit();
      }
      // Shift+Enter falls through un-prevented so the textarea's native
      // newline insertion runs.
    },
    [menuOpen, activeLength, pickHighlighted, submit]
  );

  // Auto-grow: measured and applied synchronously before paint, on every
  // value change, with no debounce - a debounced resize is exactly the kind
  // of perceptible lag this component isn't allowed to have. Also restores
  // the caret after a menu pick rewrites `value`, since that rewrite comes
  // from the controlled prop rather than the browser's own typing path.
  useLayoutEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, MAX_TEXTAREA_HEIGHT_PX)}px`;

    const pos = pendingCaretRef.current;
    if (pos !== null) {
      pendingCaretRef.current = null;
      el.focus();
      el.setSelectionRange(pos, pos);
    }
  }, [value]);

  const activeOptionId =
    menuOpen && trigger.kind !== null
      ? `indra-${trigger.kind === 'skills' ? 'slash' : 'agent'}-option-${highlightedIndex}`
      : undefined;

  return (
    <div style={{ position: 'relative', display: 'flex', flexDirection: 'column', width: '100%' }}>
      {menuOpen && trigger.kind === 'skills' ? (
        <div className="indra-rise" style={popoverStyle}>
          <SlashMenu
            query={trigger.query}
            commands={skills}
            onPick={pickSkill}
            highlightedIndex={highlightedIndex}
          />
        </div>
      ) : null}
      {menuOpen && trigger.kind === 'agents' ? (
        <div className="indra-rise" style={popoverStyle}>
          <AgentMenu
            query={trigger.query}
            agents={agents}
            onPick={pickAgent}
            highlightedIndex={highlightedIndex}
          />
        </div>
      ) : null}

      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          border: '1px solid var(--line-strong)',
          // The one place this design system's --r-lg radius is used.
          borderRadius: 'var(--r-lg)',
          background: 'var(--surface)',
        }}
      >
        <textarea
          ref={textareaRef}
          className="indra-focusable"
          value={value}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          disabled={disabled}
          placeholder="Message INDRA — / for skills, // for agents"
          rows={1}
          aria-label="Message INDRA"
          aria-haspopup="listbox"
          aria-expanded={menuOpen}
          aria-activedescendant={activeOptionId}
          style={{
            resize: 'none',
            width: '100%',
            maxHeight: MAX_TEXTAREA_HEIGHT_PX,
            padding: 'var(--space-5)',
            background: 'transparent',
            border: 'none',
            outline: 'none',
            color: 'var(--text-hi)',
            // --focus lives on exactly two things app-wide: this caret and
            // the focus ring (spec 3.2) - never a fill.
            caretColor: 'var(--focus)',
            fontFamily: 'var(--font-ui)',
            fontSize: 'var(--t-14)',
            lineHeight: 'var(--t-14--line-height)',
            fontWeight: 400,
          }}
        />

        <StatusRow
          modelName={modelName}
          workspaceLabel={workspaceLabel}
          permissionMode={permissionMode}
          onPermissionModeChange={onPermissionModeChange}
        />
      </div>
    </div>
  );
}
