import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { McpConnectors, type McpServerRow } from './McpConnectors';

const servers: McpServerRow[] = [
  {
    key: 'developer',
    name: 'Developer',
    transport: 'builtin',
    target: 'Built-in',
    state: 'connected',
    toolCount: null,
    removable: false,
  },
  {
    key: 'plant-historian',
    name: 'Plant historian',
    transport: 'stdio',
    target: 'npx -y @modelcontextprotocol/server-historian',
    state: 'disconnected',
    toolCount: 3,
    removable: true,
  },
  {
    key: 'broken-server',
    name: 'Broken server',
    transport: 'streamable_http',
    target: 'https://mcp.example.com/mcp',
    state: 'error',
    errorMessage: 'connection refused',
    toolCount: null,
    removable: true,
  },
];

function renderConnectors(overrides: Partial<React.ComponentProps<typeof McpConnectors>> = {}) {
  const onAdd = vi.fn();
  const onToggle = vi.fn();
  const onRemove = vi.fn();
  const utils = render(
    <McpConnectors servers={servers} onAdd={onAdd} onToggle={onToggle} onRemove={onRemove} {...overrides} />
  );
  return { ...utils, onAdd, onToggle, onRemove };
}

describe('McpConnectors', () => {
  it('lists each server by name with its command or URL', () => {
    renderConnectors();
    expect(screen.getByText('Developer')).toBeInTheDocument();
    expect(screen.getByText('Plant historian')).toBeInTheDocument();
    expect(
      screen.getByText('npx -y @modelcontextprotocol/server-historian')
    ).toBeInTheDocument();
    expect(screen.getByText('https://mcp.example.com/mcp')).toBeInTheDocument();
  });

  it('states connection status in words, not colour alone', () => {
    renderConnectors();
    expect(screen.getByText('Connected')).toBeInTheDocument();
    expect(screen.getByText('Disconnected')).toBeInTheDocument();
    expect(screen.getByText('Connection error')).toBeInTheDocument();
  });

  it('shows the real error message for a server in error state', () => {
    renderConnectors();
    expect(screen.getByText('connection refused')).toBeInTheDocument();
  });

  it('shows tool counts, distinguishing unrestricted from an explicit allow-list', () => {
    renderConnectors();
    expect(screen.getByText('3 tools allowed')).toBeInTheDocument();
    expect(screen.getAllByText('All tools').length).toBeGreaterThan(0);
  });

  it('names the next action when no servers are configured, never a dead end', () => {
    renderConnectors({ servers: [] });
    expect(screen.getByText(/no mcp servers connected yet/i)).toBeInTheDocument();
    expect(screen.getByText(/add one above/i)).toBeInTheDocument();
  });

  it('summarizes the count, connected, and error totals', () => {
    renderConnectors();
    expect(screen.getByText('3 servers · 1 connected · 1 with errors')).toBeInTheDocument();
  });

  it('toggles a disconnected server on via onToggle', async () => {
    const user = userEvent.setup();
    const { onToggle } = renderConnectors();
    const row = screen.getByText('Plant historian').closest('li')!;
    await user.click(within(row).getByRole('button', { name: 'Enable' }));
    expect(onToggle).toHaveBeenCalledWith('plant-historian', true);
  });

  it('toggles a connected server off via onToggle', async () => {
    const user = userEvent.setup();
    const { onToggle } = renderConnectors();
    const row = screen.getByText('Developer').closest('li')!;
    await user.click(within(row).getByRole('button', { name: 'Disable' }));
    expect(onToggle).toHaveBeenCalledWith('developer', false);
  });

  it('removes a removable server via onRemove', async () => {
    const user = userEvent.setup();
    const { onRemove } = renderConnectors();
    await user.click(screen.getByRole('button', { name: 'Remove Plant historian' }));
    expect(onRemove).toHaveBeenCalledWith('plant-historian');
  });

  it('disables removal of a built-in server and explains why', () => {
    renderConnectors();
    const removeButton = screen.getByRole('button', { name: 'Remove Developer' });
    expect(removeButton).toBeDisabled();
    expect(removeButton).toHaveAttribute('title', expect.stringMatching(/built into indra/i));
  });

  it('adds a stdio server with the typed command line', async () => {
    const user = userEvent.setup();
    const { onAdd } = renderConnectors();

    await user.type(screen.getByLabelText('Server name'), 'File search');
    await user.type(
      screen.getByLabelText('Command and arguments'),
      'uvx mcp-server-fs --root /data'
    );
    await user.click(screen.getByRole('button', { name: 'Add server' }));

    expect(onAdd).toHaveBeenCalledWith({
      transport: 'stdio',
      name: 'File search',
      commandLine: 'uvx mcp-server-fs --root /data',
    });
  });

  it('adds a streamable_http server by URL when Command is switched to URL', async () => {
    const user = userEvent.setup();
    const { onAdd } = renderConnectors();

    await user.click(screen.getByRole('button', { name: 'URL' }));
    await user.type(screen.getByLabelText('Server name'), 'Plant LAN server');
    await user.type(screen.getByLabelText('Server URL'), 'https://10.4.2.15:8090/mcp');
    await user.click(screen.getByRole('button', { name: 'Add server' }));

    expect(onAdd).toHaveBeenCalledWith({
      transport: 'streamable_http',
      name: 'Plant LAN server',
      url: 'https://10.4.2.15:8090/mcp',
    });
  });

  it('keeps the add button disabled until both name and target are filled', async () => {
    const user = userEvent.setup();
    renderConnectors({ servers: [] });

    const submit = screen.getByRole('button', { name: 'Add server' });
    expect(submit).toBeDisabled();

    await user.type(screen.getByLabelText('Server name'), 'Only a name');
    expect(submit).toBeDisabled();
  });

  it('marks every interactive element focusable per the design system', () => {
    renderConnectors();
    const interactive = [
      ...screen.getAllByRole('button'),
      ...screen.getAllByRole('textbox'),
    ];
    expect(interactive.length).toBeGreaterThan(0);
    interactive.forEach((element) => {
      expect(element).toHaveClass('indra-focusable');
    });
  });
});
