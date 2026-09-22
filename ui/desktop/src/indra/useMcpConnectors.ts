import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  addConfigExtension,
  getConfiguredExtensions,
  removeConfigExtension,
  setConfigExtensionEnabled,
  type ConfiguredExtensionEntry,
} from '../acp/extensions';
import { nameToKey, splitCmdAndArgs } from '../components/settings/extensions/utils';
import type {
  McpServerRow,
  McpTransport,
  NewMcpServerInput,
} from '../components/indra-shell/McpConnectors';
import type { ExtensionConfig } from '../types/extensions';

/**
 * The same config-level extension list and mutations that
 * ui/desktop/src/components/settings/extensions/ExtensionsSection.tsx drives
 * through useConfig() - reused here rather than reinvented, just reshaped into
 * McpServerRow for the INDRA-styled McpConnectors surface.
 */
function keyFor(entry: Pick<ConfiguredExtensionEntry, 'configKey' | 'name'>): string {
  return entry.configKey ?? nameToKey(entry.name);
}

function targetFor(entry: ConfiguredExtensionEntry): string {
  if (entry.type === 'stdio') {
    return [entry.cmd, ...(entry.args ?? [])].filter((part) => part.length > 0).join(' ');
  }
  if (entry.type === 'streamable_http') {
    return entry.uri;
  }
  return 'Built-in';
}

/**
 * available_tools is an allow-list (ExtensionConfig's own doc comment: "Omit
 * this field to allow all tools"), not a live count of what the server
 * exposes - ACP does not surface that count anywhere today. null means
 * unrestricted, not "unknown".
 */
function toolCountFor(entry: ConfiguredExtensionEntry): number | null {
  const tools = 'available_tools' in entry ? entry.available_tools : undefined;
  return tools && tools.length > 0 ? tools.length : null;
}

export function toServerRow(entry: ConfiguredExtensionEntry, errorMessage?: string): McpServerRow {
  return {
    key: keyFor(entry),
    name: entry.name,
    transport: entry.type as McpTransport,
    target: targetFor(entry),
    state: errorMessage ? 'error' : entry.enabled ? 'connected' : 'disconnected',
    errorMessage,
    toolCount: toolCountFor(entry),
    removable: !(entry.type === 'builtin' || entry.bundled === true),
  };
}

function messageFor(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback;
}

export interface UseMcpConnectorsResult {
  servers: McpServerRow[];
  loading: boolean;
  /** Set when the initial/most recent list refresh itself failed. */
  loadError: string | null;
  addServer: (input: NewMcpServerInput) => Promise<void>;
  removeServer: (key: string) => Promise<void>;
  toggleServer: (key: string, enabled: boolean) => Promise<void>;
  refresh: () => Promise<void>;
}

/**
 * ACP calls behind a small hook, per convention - McpConnectors.tsx itself
 * stays presentational (props in, callbacks out) so a parallel effort can
 * mount it with this hook, or with any other data source (tests, Storybook).
 */
export function useMcpConnectors(): UseMcpConnectorsResult {
  const [entries, setEntries] = useState<ConfiguredExtensionEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [rowErrors, setRowErrors] = useState<Record<string, string>>({});

  const refresh = useCallback(async () => {
    try {
      const response = await getConfiguredExtensions();
      setEntries(response.extensions);
      setLoadError(null);
    } catch (error) {
      setLoadError(messageFor(error, 'Failed to load MCP servers'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const clearRowError = useCallback((key: string) => {
    setRowErrors((prev) => {
      if (!(key in prev)) return prev;
      const next = { ...prev };
      delete next[key];
      return next;
    });
  }, []);

  const addServer = useCallback(
    async (input: NewMcpServerInput) => {
      const config: ExtensionConfig =
        input.transport === 'stdio'
          ? { type: 'stdio', name: input.name, ...splitCmdAndArgs(input.commandLine) }
          : { type: 'streamable_http', name: input.name, uri: input.url };
      await addConfigExtension(config, true);
      await refresh();
    },
    [refresh]
  );

  const removeServer = useCallback(
    async (key: string) => {
      await removeConfigExtension(key);
      clearRowError(key);
      await refresh();
    },
    [clearRowError, refresh]
  );

  const toggleServer = useCallback(
    async (key: string, enabled: boolean) => {
      try {
        await setConfigExtensionEnabled(key, enabled);
        clearRowError(key);
        await refresh();
      } catch (error) {
        setRowErrors((prev) => ({ ...prev, [key]: messageFor(error, 'Failed to update this server') }));
        throw error;
      }
    },
    [clearRowError, refresh]
  );

  const servers = useMemo(
    () => entries.map((entry) => toServerRow(entry, rowErrors[keyFor(entry)])),
    [entries, rowErrors]
  );

  return { servers, loading, loadError, addServer, removeServer, toggleServer, refresh };
}
