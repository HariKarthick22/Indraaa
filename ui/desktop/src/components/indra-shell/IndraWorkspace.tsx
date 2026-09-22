import { useCallback, useEffect, useMemo, useState, type CSSProperties } from 'react';
import { acpEgressProbe, acpEgressStatus, type EgressAttempt } from '../../acp/sovereignty';
import { DEFAULT_THEME, applyTheme, type Theme } from '../../indra/theme';
import { buildPaletteIndex, type PaletteEntry } from '../../indra/paletteIndex';
import { skillCommandsToPaletteEntries, useSkillCommands } from '../../indra/skills';
import { useKeymap } from '../../indra/useKeymap';
import { AppearancePanel } from './AppearancePanel';
import { CommandPalette } from './CommandPalette';
import { ContextLedger } from './ContextLedger';
import { Constellation } from './Constellation';
import { IndraShell } from './IndraShell';
import type { IndraRailDestination } from './IndraRail';
import { MemoryLedger, type MemoryNode } from './MemoryLedger';
import { MemoryTimeline } from './MemoryTimeline';
import { Sheet } from './Sheet';
import { SourcesLibrary, type DocumentSummary, type SourcesView } from './SourcesLibrary';
import { SovereigntyScreen } from './SovereigntyScreen';
import { TraceScreen, type TraceRun } from './TraceScreen';
import { WorkspaceFolders } from './WorkspaceFolders';
import { useWorkspaceFolders } from '../../indra/workspaceFolders';

const DESTINATION_TITLES: Record<IndraRailDestination, string> = {
  work: 'Work',
  memory: 'Memory',
  sources: 'Sources',
  trace: 'Trace',
  sovereignty: 'Sovereignty',
};

type MemoryView = 'ledger' | 'constellation' | 'timeline';
type SheetContent = 'appearance' | 'context-ledger' | null;

const panelHeading: CSSProperties = {
  fontSize: 'var(--t-20)',
  fontWeight: 600,
  color: 'var(--text-hi)',
  margin: 0,
};

const segmentRow: CSSProperties = {
  display: 'flex',
  gap: 'var(--space-2)',
};

function segmentButton(active: boolean): CSSProperties {
  return {
    height: 28,
    padding: '0 var(--space-4)',
    borderRadius: 'var(--r-sm)',
    border: '1px solid ' + (active ? 'var(--text-hi)' : 'var(--line-strong)'),
    background: active ? 'var(--raised)' : 'transparent',
    color: active ? 'var(--text-hi)' : 'var(--text-dim)',
    fontFamily: 'var(--font-ui)',
    fontSize: 'var(--t-12)',
    fontWeight: 500,
    cursor: 'pointer',
  };
}

/** Work screen isn't wired here: it renders the live chat transcript, which lives outside indra-shell. */
function WorkPlaceholder() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
      <h1 style={panelHeading}>Work</h1>
      <p style={{ color: 'var(--text-dim)', fontSize: 'var(--t-13)', margin: 0 }}>
        The transcript, plan card, and tool rows mount here once wired to the session's live
        message list.
      </p>
    </div>
  );
}

function MemoryDestination() {
  const [view, setView] = useState<MemoryView>('ledger');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  // No ACP method yet lists memory nodes/edges — empty rather than fabricated
  // data, consistent with the rest of the app never inventing state it was
  // not sent.
  const nodes: MemoryNode[] = [];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-5)', height: '100%' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <h1 style={panelHeading}>Memory</h1>
        <div style={segmentRow} role="tablist" aria-label="Memory view">
          {(['ledger', 'constellation', 'timeline'] as const).map((v) => (
            <button
              key={v}
              type="button"
              role="tab"
              aria-selected={view === v}
              className="indra-focusable"
              style={segmentButton(view === v)}
              onClick={() => setView(v)}
            >
              {v === 'ledger' ? 'Ledger' : v === 'constellation' ? 'Constellation' : 'Timeline'}
            </button>
          ))}
        </div>
      </div>

      {view === 'ledger' ? (
        <MemoryLedger nodes={nodes} selectedIds={selectedIds} onSelectionChange={setSelectedIds} />
      ) : view === 'constellation' ? (
        <Constellation nodes={nodes} edges={[]} onLassoSelect={setSelectedIds} />
      ) : (
        <MemoryTimeline lanes={[]} />
      )}
    </div>
  );
}

function SourcesDestination() {
  const [view, setView] = useState<SourcesView>('list');
  const { folders, addFolder, removeFolder, setFolderMode } = useWorkspaceFolders();
  // No ACP method yet lists the document corpus — see MemoryDestination.
  const documents: DocumentSummary[] = [];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-7)' }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-5)' }}>
        <h1 style={panelHeading}>Workspace folders</h1>
        <WorkspaceFolders
          folders={folders}
          onAdd={addFolder}
          onRemove={removeFolder}
          onModeChange={setFolderMode}
        />
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-5)' }}>
        <h1 style={panelHeading}>Sources</h1>
        <SourcesLibrary
          documents={documents}
          view={view}
          onOpen={() => {}}
          onViewChange={setView}
        />
      </div>
    </div>
  );
}

function TraceDestination() {
  // No run-history persistence endpoint yet — a run appears here once the
  // backend starts recording a session's event stream for replay.
  const runs: TraceRun[] = [];
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-5)' }}>
      <h1 style={panelHeading}>Trace</h1>
      <TraceScreen runs={runs} onExport={() => {}} />
    </div>
  );
}

function SovereigntyDestination() {
  const [attempts, setAttempts] = useState<EgressAttempt[]>([]);
  const [uptimeSeconds, setUptimeSeconds] = useState(0);

  const refresh = useCallback(async () => {
    try {
      const status = await acpEgressStatus();
      setAttempts(status.attempts);
      setUptimeSeconds(status.uptimeSeconds);
    } catch (error) {
      console.error('Failed to read sovereignty status:', error);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const handleProbe = useCallback(
    async (url: string) => {
      await acpEgressProbe(url);
      await refresh();
    },
    [refresh]
  );

  return (
    <SovereigntyScreen
      attempts={attempts}
      uptimeSeconds={uptimeSeconds}
      // No ACP method yet reports live sandbox/model-fit counts; the egress
      // log above is the part of this screen the backend actually drives.
      sandboxBackend="sandboxed"
      modelsLoaded={0}
      degradedCount={0}
      sealedCount={0}
      onProbe={handleProbe}
    />
  );
}

export function IndraWorkspace() {
  const [active, setActive] = useState<IndraRailDestination>('work');
  const [sessionTitle, setSessionTitle] = useState('New session');
  const [theme, setTheme] = useState<Theme>(DEFAULT_THEME);
  const [sheetContent, setSheetContent] = useState<SheetContent>(null);
  const [paletteOpen, setPaletteOpen] = useState(false);

  const skillCommands = useSkillCommands();

  useEffect(() => {
    applyTheme(theme);
  }, [theme]);

  const paletteEntries = useMemo<PaletteEntry[]>(() => {
    const destinationEntries = buildPaletteIndex({
      destinations: (Object.keys(DESTINATION_TITLES) as IndraRailDestination[]).map((id) => ({
        id,
        label: DESTINATION_TITLES[id],
        go: () => setActive(id),
      })),
      themes: [{ id: 'appearance', label: 'Appearance', apply: () => setSheetContent('appearance') }],
    });
    const skillEntries = skillCommandsToPaletteEntries(skillCommands, () => {});
    return [...destinationEntries, ...skillEntries];
  }, [skillCommands]);

  useKeymap({
    onOpenPalette: () => setPaletteOpen(true),
    onToggleSheet: () => setSheetContent((current) => (current === 'appearance' ? null : 'appearance')),
    onOpenContextLedger: () => setSheetContent('context-ledger'),
    onSelectDestination: setActive,
    isSheetOpen: sheetContent !== null || paletteOpen,
    onCloseSheet: () => {
      setSheetContent(null);
      setPaletteOpen(false);
    },
  });

  const toggleTheme = () => {
    setTheme((current) => ({ ...current, base: current.base === 'light' ? 'dark' : 'light' }));
  };

  return (
    <IndraShell
      active={active}
      onSelect={setActive}
      sessionTitle={sessionTitle}
      onSessionTitleChange={setSessionTitle}
      sessionBytes={0}
      budgetBytes={32768}
      onToggleTheme={toggleTheme}
      onOpenLedger={() => setSheetContent('context-ledger')}
    >
      {active === 'work' && <WorkPlaceholder />}
      {active === 'memory' && <MemoryDestination />}
      {active === 'sources' && <SourcesDestination />}
      {active === 'trace' && <TraceDestination />}
      {active === 'sovereignty' && <SovereigntyDestination />}

      <CommandPalette open={paletteOpen} entries={paletteEntries} onClose={() => setPaletteOpen(false)} />

      <Sheet
        open={sheetContent === 'appearance'}
        width={520}
        title="Appearance"
        onClose={() => setSheetContent(null)}
      >
        <AppearancePanel theme={theme} onChange={setTheme} />
      </Sheet>

      <Sheet
        open={sheetContent === 'context-ledger'}
        width={480}
        title="Context"
        onClose={() => setSheetContent(null)}
      >
        <ContextLedger sections={[]} onPin={() => {}} onDrop={() => {}} />
      </Sheet>
    </IndraShell>
  );
}
