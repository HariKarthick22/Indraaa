import {
  useCallback,
  useState,
  type CSSProperties,
  type FocusEvent,
  type FormEvent,
  type ReactNode,
} from 'react';

/**
 * `builtin`/`platform` run in-process (see crates/indra-mcp's BUILTIN_EXTENSIONS
 * and crates/indra/src/agents/platform_extensions) and have no command or URL of
 * their own; `stdio`/`streamable_http` are the two transports a user can add by
 * hand (crates/indra/src/agents/extension.rs's ExtensionConfig).
 */
export type McpTransport = 'stdio' | 'streamable_http' | 'builtin' | 'platform';

export type McpConnectionState = 'connected' | 'disconnected' | 'error';

export interface McpServerRow {
  /** The config key the backend addresses this server by (ExtensionConfig::key()). */
  key: string;
  name: string;
  transport: McpTransport;
  /** The command line (stdio) or URL (streamable_http); "Built-in" otherwise. */
  target: string;
  state: McpConnectionState;
  /** Set only when state is 'error' - the real message from the failed call. */
  errorMessage?: string;
  /**
   * Tools allow-listed for this server, or null when unrestricted (the common
   * case - ExtensionConfig's available_tools is an allow-list, not a live
   * count of what the server exposes; nothing in ACP surfaces that count).
   */
  toolCount: number | null;
  /** False for builtin/bundled servers, which ship with INDRA and cannot be removed. */
  removable: boolean;
}

export type NewMcpServerInput =
  | { transport: 'stdio'; name: string; commandLine: string }
  | { transport: 'streamable_http'; name: string; url: string };

export interface McpConnectorsProps {
  servers: McpServerRow[];
  onAdd: (input: NewMcpServerInput) => void | Promise<void>;
  onToggle: (key: string, enabled: boolean) => void | Promise<void>;
  onRemove: (key: string) => void | Promise<void>;
}

/**
 * Focus ring, per section 8: 2px var(--focus) at 2px offset, on every
 * interactive element, never removed for mouse users. Inline styles cannot
 * express :focus-visible, so focus is tracked in state and the ring is always
 * drawn on focus - stricter than the spec, never laxer. (Matches
 * SourcesLibrary.tsx's local copy of this hook.)
 */
function useFocusRing() {
  const [focused, setFocused] = useState(false);
  const onFocus = useCallback((_event: FocusEvent<HTMLElement>) => setFocused(true), []);
  const onBlur = useCallback((_event: FocusEvent<HTMLElement>) => setFocused(false), []);
  const ringStyle: CSSProperties = focused
    ? { outline: '2px solid var(--focus)', outlineOffset: '2px' }
    : { outline: 'none' };
  return { onFocus, onBlur, ringStyle };
}

const mono: CSSProperties = {
  fontFamily: 'var(--font-mono)',
  fontVariantNumeric: 'tabular-nums',
};

const STATE_LABEL: Record<McpConnectionState, string> = {
  connected: 'Connected',
  disconnected: 'Disconnected',
  error: 'Connection error',
};

/**
 * Achromatic by default (spec 3.2/8): 'disconnected' is a deliberate, chosen
 * state, not a failure, so it carries no signal colour at all. 'connected'
 * gets --sealed, 'error' gets --blocked - always paired with STATE_LABEL and a
 * distinct glyph shape below, never colour alone.
 */
const STATE_COLOR: Record<McpConnectionState, string | undefined> = {
  connected: 'var(--sealed)',
  disconnected: undefined,
  error: 'var(--blocked)',
};

/** Filled dot / open ring / triangle - three distinct shapes, not one dot recoloured. */
function StateGlyph({ state }: { state: McpConnectionState }) {
  if (state === 'error') {
    return (
      <span aria-hidden="true" style={{ lineHeight: 1 }}>
        {'▲'}
      </span>
    );
  }
  if (state === 'connected') {
    return (
      <svg width="8" height="8" viewBox="0 0 8 8" aria-hidden="true" focusable="false">
        <circle cx="4" cy="4" r="4" fill="currentColor" />
      </svg>
    );
  }
  return (
    <svg width="8" height="8" viewBox="0 0 8 8" aria-hidden="true" focusable="false">
      <circle cx="4" cy="4" r="3.2" fill="none" stroke="currentColor" strokeWidth="1.2" />
    </svg>
  );
}

function ConnectionState({ state, errorMessage }: { state: McpConnectionState; errorMessage?: string }) {
  const color = STATE_COLOR[state] ?? 'var(--text-dim)';
  return (
    <span style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-1)', minWidth: 0 }}>
      <span
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 'var(--space-2)',
          color,
          fontSize: 'var(--t-12)',
          lineHeight: 'var(--t-12--line-height)',
          fontWeight: 500,
        }}
      >
        <StateGlyph state={state} />
        {STATE_LABEL[state]}
      </span>
      {state === 'error' && errorMessage ? (
        <span
          style={{
            color: 'var(--text-dim)',
            fontSize: 'var(--t-11)',
            lineHeight: 'var(--t-11--line-height)',
            overflowWrap: 'anywhere',
          }}
        >
          {errorMessage}
        </span>
      ) : null}
    </span>
  );
}

function ToolCount({ count }: { count: number | null }) {
  return (
    <span style={{ ...mono, color: 'var(--text-dim)', fontSize: 'var(--t-12)' }}>
      {count === null ? 'All tools' : `${count} tool${count === 1 ? '' : 's'} allowed`}
    </span>
  );
}

const TRANSPORT_LABEL: Record<McpTransport, string> = {
  stdio: 'Command',
  streamable_http: 'URL',
  builtin: 'Built-in',
  platform: 'Built-in',
};

interface ServerRowProps {
  server: McpServerRow;
  hovered: boolean;
  onHoverChange: (key: string | null) => void;
  onToggle: (key: string, enabled: boolean) => void | Promise<void>;
  onRemove: (key: string) => void | Promise<void>;
}

function ServerRow({ server, hovered, onHoverChange, onToggle, onRemove }: ServerRowProps) {
  const toggleRing = useFocusRing();
  const removeRing = useFocusRing();
  const [pending, setPending] = useState(false);
  const edge = hovered ? 'var(--line-strong)' : 'var(--line)';
  const accent = STATE_COLOR[server.state] ?? 'var(--line-strong)';
  const isEnabled = server.state !== 'disconnected';

  const handleToggle = useCallback(async () => {
    setPending(true);
    try {
      await onToggle(server.key, !isEnabled);
    } finally {
      setPending(false);
    }
  }, [isEnabled, onToggle, server.key]);

  const handleRemove = useCallback(async () => {
    setPending(true);
    try {
      await onRemove(server.key);
    } finally {
      setPending(false);
    }
  }, [onRemove, server.key]);

  return (
    <li
      onMouseEnter={() => onHoverChange(server.key)}
      onMouseLeave={() => onHoverChange(null)}
      style={{
        display: 'flex',
        alignItems: 'center',
        flexWrap: 'wrap',
        justifyContent: 'space-between',
        gap: 'var(--space-4)',
        minHeight: 52,
        padding: 'var(--space-4)',
        background: hovered ? 'var(--hover)' : 'var(--raised)',
        border: `1px solid ${edge}`,
        // Signal colour as a 2px left rule only - never a panel fill (spec 3.2).
        borderLeft: `2px solid ${accent}`,
        borderRadius: 'var(--r-sm)',
      }}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-1)', flex: '1 1 200px', minWidth: 0 }}>
        <span
          style={{
            color: 'var(--text-hi)',
            fontSize: 'var(--t-14)',
            lineHeight: 'var(--t-14--line-height)',
            fontWeight: 500,
            overflowWrap: 'anywhere',
          }}
        >
          {server.name}
        </span>
        <span
          style={{
            display: 'inline-flex',
            alignItems: 'baseline',
            gap: 'var(--space-2)',
            color: 'var(--text-dim)',
            fontSize: 'var(--t-12)',
            lineHeight: 'var(--t-12--line-height)',
          }}
        >
          <span>{TRANSPORT_LABEL[server.transport]}</span>
          <span style={{ ...mono, color: 'var(--text-dim)', overflowWrap: 'anywhere' }}>
            {server.target}
          </span>
        </span>
      </div>

      <div style={{ flex: '0 0 auto' }}>
        <ConnectionState state={server.state} errorMessage={server.errorMessage} />
      </div>

      <div style={{ flex: '0 0 auto' }}>
        <ToolCount count={server.toolCount} />
      </div>

      <div style={{ display: 'inline-flex', gap: 'var(--space-2)', flexShrink: 0 }}>
        <button
          type="button"
          className="indra-focusable"
          aria-pressed={isEnabled}
          disabled={pending}
          onClick={handleToggle}
          onFocus={toggleRing.onFocus}
          onBlur={toggleRing.onBlur}
          style={{
            height: 26,
            padding: '0 var(--space-4)',
            background: 'transparent',
            border: '1px solid var(--line-strong)',
            borderRadius: 'var(--r-sm)',
            color: 'var(--text-hi)',
            fontFamily: 'var(--font-ui)',
            fontSize: 'var(--t-12)',
            fontWeight: 500,
            cursor: pending ? 'default' : 'pointer',
            opacity: pending ? 0.6 : 1,
            ...toggleRing.ringStyle,
          }}
        >
          {isEnabled ? 'Disable' : 'Enable'}
        </button>
        <button
          type="button"
          className="indra-focusable"
          aria-label={`Remove ${server.name}`}
          title={server.removable ? 'Remove' : 'Built into INDRA - cannot be removed'}
          disabled={pending || !server.removable}
          onClick={handleRemove}
          onFocus={removeRing.onFocus}
          onBlur={removeRing.onBlur}
          style={{
            width: 26,
            height: 26,
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'transparent',
            border: '1px solid var(--line)',
            borderRadius: 'var(--r-sm)',
            color: server.removable ? 'var(--text-dim)' : 'var(--text-faint)',
            cursor: pending || !server.removable ? 'default' : 'pointer',
            opacity: pending ? 0.6 : 1,
            ...removeRing.ringStyle,
          }}
        >
          <svg width="10" height="10" viewBox="0 0 10 10" aria-hidden="true" focusable="false">
            <path d="M1 1L9 9M9 1L1 9" stroke="currentColor" strokeWidth="1.3" />
          </svg>
        </button>
      </div>
    </li>
  );
}

const COMMAND_GLYPH = (
  <svg width="11" height="11" viewBox="0 0 12 12" aria-hidden="true" focusable="false">
    <path d="M1.5 2.5 5 6l-3.5 3.5" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M6.5 9.5h4" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
  </svg>
);

/** A chain link, deliberately unlike the prompt glyph above - shape carries meaning, not only colour. */
const URL_GLYPH = (
  <svg width="11" height="11" viewBox="0 0 12 12" aria-hidden="true" focusable="false">
    <path
      d="M5 7 7 5M4.3 6.2 2.6 7.9a1.5 1.5 0 0 0 2.1 2.1l1.7-1.7M7.7 5.8l1.7-1.7a1.5 1.5 0 0 0-2.1-2.1L5.6 3.7"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.1"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

interface TransportToggleButtonProps {
  label: string;
  glyph: ReactNode;
  pressed: boolean;
  onPress: () => void;
}

function TransportToggleButton({ label, glyph, pressed, onPress }: TransportToggleButtonProps) {
  const { onFocus, onBlur, ringStyle } = useFocusRing();
  return (
    <button
      type="button"
      className="indra-focusable"
      aria-pressed={pressed}
      onClick={onPress}
      onFocus={onFocus}
      onBlur={onBlur}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 'var(--space-2)',
        height: 26,
        padding: '0 var(--space-4)',
        background: pressed ? 'var(--raised)' : 'transparent',
        border: `1px solid ${pressed ? 'var(--line-strong)' : 'var(--line)'}`,
        borderRadius: 'var(--r-sm)',
        color: pressed ? 'var(--text-hi)' : 'var(--text-dim)',
        fontFamily: 'var(--font-ui)',
        fontSize: 'var(--t-12)',
        fontWeight: 500,
        cursor: 'pointer',
        ...ringStyle,
      }}
    >
      {glyph}
      {label}
    </button>
  );
}

const fieldStyle: CSSProperties = {
  flex: '1 1 160px',
  minWidth: 0,
  padding: 'var(--space-3) var(--space-4)',
  background: 'var(--bg)',
  border: '1px solid var(--line-strong)',
  borderRadius: 'var(--r-sm)',
  outline: 'none',
  color: 'var(--text-hi)',
  caretColor: 'var(--focus)',
  fontFamily: 'var(--font-mono)',
  fontSize: 'var(--t-13)',
  lineHeight: 'var(--t-13--line-height)',
};

function AddServerControl({ onAdd }: { onAdd: (input: NewMcpServerInput) => void | Promise<void> }) {
  const [transport, setTransport] = useState<'stdio' | 'streamable_http'>('stdio');
  const [name, setName] = useState('');
  const [target, setTarget] = useState('');
  const [pending, setPending] = useState(false);
  const submitRing = useFocusRing();

  const trimmedName = name.trim();
  const trimmedTarget = target.trim();
  const canSubmit = trimmedName.length > 0 && trimmedTarget.length > 0 && !pending;

  const handleSubmit = useCallback(
    async (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      if (!canSubmit) return;
      setPending(true);
      try {
        if (transport === 'stdio') {
          await onAdd({ transport: 'stdio', name: trimmedName, commandLine: trimmedTarget });
        } else {
          await onAdd({ transport: 'streamable_http', name: trimmedName, url: trimmedTarget });
        }
        setName('');
        setTarget('');
      } finally {
        setPending(false);
      }
    },
    [canSubmit, onAdd, transport, trimmedName, trimmedTarget]
  );

  return (
    <form
      onSubmit={handleSubmit}
      style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}
    >
      <span role="group" aria-label="Server type" style={{ display: 'inline-flex', gap: 'var(--space-2)' }}>
        <TransportToggleButton
          label="Command"
          glyph={COMMAND_GLYPH}
          pressed={transport === 'stdio'}
          onPress={() => setTransport('stdio')}
        />
        <TransportToggleButton
          label="URL"
          glyph={URL_GLYPH}
          pressed={transport === 'streamable_http'}
          onPress={() => setTransport('streamable_http')}
        />
      </span>
      <div style={{ display: 'flex', gap: 'var(--space-3)', flexWrap: 'wrap' }}>
        <input
          type="text"
          className="indra-focusable"
          value={name}
          onChange={(event) => setName(event.target.value)}
          aria-label="Server name"
          placeholder="Name"
          spellCheck={false}
          autoComplete="off"
          style={{ ...fieldStyle, flex: '1 1 120px' }}
        />
        <input
          type="text"
          className="indra-focusable"
          value={target}
          onChange={(event) => setTarget(event.target.value)}
          aria-label={transport === 'stdio' ? 'Command and arguments' : 'Server URL'}
          placeholder={transport === 'stdio' ? 'npx -y @modelcontextprotocol/server-name' : 'https://mcp.example.com/mcp'}
          spellCheck={false}
          autoComplete="off"
          style={{ ...fieldStyle, flex: '2 1 240px' }}
        />
        <button
          type="submit"
          className="indra-focusable"
          disabled={!canSubmit}
          onFocus={submitRing.onFocus}
          onBlur={submitRing.onBlur}
          style={{
            flexShrink: 0,
            height: 32,
            padding: '0 var(--space-5)',
            background: 'transparent',
            border: '1px solid var(--line-strong)',
            borderRadius: 'var(--r-sm)',
            color: 'var(--text-hi)',
            fontFamily: 'var(--font-ui)',
            fontSize: 'var(--t-13)',
            fontWeight: 500,
            cursor: canSubmit ? 'pointer' : 'default',
            opacity: canSubmit ? 1 : 0.5,
            ...submitRing.ringStyle,
          }}
        >
          {pending ? 'Adding…' : 'Add server'}
        </button>
      </div>
    </form>
  );
}

function EmptyState() {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'flex-start',
        gap: 'var(--space-3)',
        padding: 'var(--space-7)',
        background: 'var(--surface)',
        border: '1px solid var(--line)',
        borderRadius: 'var(--r-md)',
        fontSize: 'var(--t-13)',
        lineHeight: 'var(--t-13--line-height)',
        color: 'var(--text-dim)',
      }}
    >
      <span style={{ color: 'var(--text)', fontWeight: 500 }}>No MCP servers connected yet</span>
      <span>
        Add one above - paste a command to run it locally, or a URL to reach one on your network.
      </span>
    </div>
  );
}

function summarizeServers(servers: McpServerRow[]): string {
  const connected = servers.filter((server) => server.state === 'connected').length;
  const errored = servers.filter((server) => server.state === 'error').length;
  const parts = [servers.length === 1 ? '1 server' : `${servers.length} servers`];
  if (connected > 0) parts.push(`${connected} connected`);
  if (errored > 0) parts.push(`${errored} with errors`);
  return parts.join(' · ');
}

/**
 * Manage MCP (Model Context Protocol) server connections. A cleaner,
 * INDRA-styled surface over the same extension config the Settings > Extensions
 * screen edits (ui/desktop/src/components/settings/extensions) - same data
 * shapes, same ACP calls, reused via useMcpConnectors in ui/desktop/src/indra.
 */
export function McpConnectors({ servers, onAdd, onToggle, onRemove }: McpConnectorsProps) {
  const [hoveredKey, setHoveredKey] = useState<string | null>(null);

  return (
    <section
      aria-label="MCP connectors"
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 'var(--space-5)',
        width: '100%',
        color: 'var(--text)',
        fontFamily: 'var(--font-ui)',
        fontSize: 'var(--t-14)',
        lineHeight: 'var(--t-14--line-height)',
      }}
    >
      <header
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 'var(--space-4)',
          paddingBottom: 'var(--space-4)',
          borderBottom: '1px solid var(--line)',
        }}
      >
        <span
          style={{
            color: 'var(--text-dim)',
            fontSize: 'var(--t-12)',
            lineHeight: 'var(--t-12--line-height)',
            fontVariantNumeric: 'tabular-nums',
          }}
        >
          {servers.length === 0 ? 'No servers added' : summarizeServers(servers)}
        </span>
        <AddServerControl onAdd={onAdd} />
      </header>

      {servers.length === 0 ? (
        <EmptyState />
      ) : (
        <ul
          style={{
            listStyle: 'none',
            margin: 0,
            padding: 0,
            display: 'flex',
            flexDirection: 'column',
            gap: 'var(--space-2)',
          }}
        >
          {servers.map((server) => (
            <ServerRow
              key={server.key}
              server={server}
              hovered={hoveredKey === server.key}
              onHoverChange={setHoveredKey}
              onToggle={onToggle}
              onRemove={onRemove}
            />
          ))}
        </ul>
      )}
    </section>
  );
}
