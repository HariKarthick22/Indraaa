import { useState, type CSSProperties, type FormEvent } from 'react';
import { ModelTable, type ModelRow } from './ModelTable';

export interface SetupModelsProps {
  rows: ModelRow[];
  onAddDirectory: (path: string) => void;
  onAddServer: (endpoint: string) => void;
  onNext: () => void;
}

const column: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  width: '100%',
};

const heading: CSSProperties = {
  margin: 0,
  fontSize: 'var(--t-28)',
  lineHeight: 'var(--t-28--line-height)',
  fontWeight: 600,
  color: 'var(--text-hi)',
};

const panel: CSSProperties = {
  border: '1px solid var(--line)',
  borderRadius: 'var(--r-md)',
  background: 'var(--surface)',
  padding: 'var(--space-5)',
  display: 'flex',
  flexDirection: 'column',
  gap: 'var(--space-4)',
};

const panelTitle: CSSProperties = {
  margin: 0,
  fontSize: 'var(--t-13)',
  lineHeight: 'var(--t-13--line-height)',
  fontWeight: 500,
  color: 'var(--text-hi)',
};

const inputRow: CSSProperties = {
  display: 'flex',
  gap: 'var(--space-3)',
  flexWrap: 'wrap',
};

const textInput: CSSProperties = {
  flex: '1 1 240px',
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

const actionButton: CSSProperties = {
  flexShrink: 0,
  padding: 'var(--space-3) var(--space-5)',
  background: 'var(--raised)',
  border: '1px solid var(--line-strong)',
  borderRadius: 'var(--r-sm)',
  outline: 'none',
  color: 'var(--text-hi)',
  fontFamily: 'var(--font-ui)',
  fontSize: 'var(--t-13)',
  lineHeight: 'var(--t-13--line-height)',
  fontWeight: 500,
  cursor: 'pointer',
};

function EmptyDirectoryNotice() {
  return (
    <div
      style={{
        border: '1px solid var(--line)',
        borderRadius: 'var(--r-md)',
        background: 'var(--surface)',
        padding: 'var(--space-6)',
        display: 'flex',
        flexDirection: 'column',
        gap: 'var(--space-3)',
        fontSize: 'var(--t-13)',
        lineHeight: 'var(--t-13--line-height)',
        color: 'var(--text-dim)',
      }}
    >
      <span style={{ color: 'var(--text)', fontWeight: 500 }}>No models found in that directory</span>
      <span>
        INDRA reads a model weights file (<code>*.gguf</code>) from disk, and for vision models a
        matching projector file (<code>mmproj-*.gguf</code>) alongside it.
      </span>
      <span>
        Copy both from your plant&apos;s model distribution share, or by USB from another sealed
        machine — INDRA never downloads them itself.
      </span>
    </div>
  );
}

export function SetupModels({ rows, onAddDirectory, onAddServer, onNext }: SetupModelsProps) {
  const [directoryPath, setDirectoryPath] = useState('');
  const [serverEndpoint, setServerEndpoint] = useState('');
  const [hasScanned, setHasScanned] = useState(false);

  function handleScanDirectory(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const path = directoryPath.trim();
    if (path.length === 0) return;
    setHasScanned(true);
    onAddDirectory(path);
  }

  function handleAddServer(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const endpoint = serverEndpoint.trim();
    if (endpoint.length === 0) return;
    onAddServer(endpoint);
  }

  // Before a scan, ModelTable's own empty state ("Add a model...") already
  // names the next action. Only after a scan comes back empty do we need the
  // more specific notice naming the exact files and the offline copy path —
  // an empty directory must never read as a dead end (spec §5.2).
  const showEmptyDirectoryNotice = rows.length === 0 && hasScanned;

  return (
    <div style={column}>
      <div
        style={{
          width: 520,
          maxWidth: '100%',
          display: 'flex',
          flexDirection: 'column',
          gap: 'var(--space-7)',
        }}
      >
        <h1 style={heading}>Where your models live</h1>

        <form onSubmit={handleScanDirectory} style={panel}>
          <h2 style={panelTitle}>Scan a directory</h2>
          <div style={inputRow}>
            <input
              type="text"
              className="indra-focusable"
              value={directoryPath}
              onChange={(event) => setDirectoryPath(event.target.value)}
              aria-label="Model directory path"
              placeholder="/models"
              spellCheck={false}
              autoComplete="off"
              style={textInput}
            />
            <button type="submit" className="indra-focusable" style={actionButton}>
              Scan directory
            </button>
          </div>
        </form>

        <form onSubmit={handleAddServer} style={panel}>
          <h2 style={panelTitle}>Add a model server</h2>
          <div style={inputRow}>
            <input
              type="text"
              className="indra-focusable"
              value={serverEndpoint}
              onChange={(event) => setServerEndpoint(event.target.value)}
              aria-label="Model server endpoint"
              placeholder="http://10.4.2.15:8000/v1"
              spellCheck={false}
              autoComplete="off"
              style={textInput}
            />
            <button type="submit" className="indra-focusable" style={actionButton}>
              Add server
            </button>
          </div>
        </form>

        {showEmptyDirectoryNotice ? <EmptyDirectoryNotice /> : <ModelTable rows={rows} />}

        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <button type="button" className="indra-focusable" onClick={onNext} style={actionButton}>
            Continue
          </button>
        </div>
      </div>
    </div>
  );
}
