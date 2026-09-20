import { useCallback, useState, type CSSProperties, type FocusEvent, type ReactNode } from 'react';

export type SourcesView = 'grid' | 'list';

export interface DocumentSummary {
  id: string;
  title: string;
  /** File type as ingested: pdf, csv, tiff, and so on. */
  kind: string;
  version: string;
  indexed: boolean;
  /** Classification carried by the object's ACL: Internal, Restricted, and so on. */
  classification: string;
  pages: number;
  sealed: boolean;
  /**
   * The policy that seals the document, named in full.
   *
   * Spec 5.6: a sealed resource carries a lock and a tooltip that *names the
   * policy*, not a generic "no permission". A named policy tells an engineer
   * whom to ask; a generic denial is a dead end.
   */
  sealedPolicy?: string;
}

export interface SourcesLibraryProps {
  documents: DocumentSummary[];
  view: SourcesView;
  onOpen: (id: string) => void;
  onViewChange: (view: SourcesView) => void;
  /** Wired to the empty state's named next action. */
  onAddSource?: () => void;
}

/**
 * Fallback when a document is sealed but the policy did not travel with it.
 * Still not a dead end: it names who can resolve it (7.1 - an empty or blocked
 * state always names the next action).
 */
const UNNAMED_POLICY = 'policy not attached, ask your data steward';

/**
 * Focus ring, per section 8: 2px var(--focus) at 2px offset, on every
 * interactive element, never removed for mouse users. Inline styles cannot
 * express :focus-visible, so focus is tracked in state and the ring is always
 * drawn on focus - stricter than the spec, never laxer.
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

function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return false;
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

export function formatPageCount(pages: number): string {
  return `${pages} ${pages === 1 ? 'page' : 'pages'}`;
}

const LOCK_GLYPH = (
  <svg width="11" height="11" viewBox="0 0 12 12" aria-hidden="true" focusable="false">
    <rect x="2" y="5" width="8" height="6" rx="1" fill="currentColor" />
    <path d="M4 5V3.6a2 2 0 0 1 4 0V5" fill="none" stroke="currentColor" strokeWidth="1.2" />
  </svg>
);

interface SealMarkProps {
  policy: string;
}

/**
 * The lock in the corner. Signal colour is carried by an 11px glyph and the
 * word "Sealed" - never a fill (3.2: signal colour is never a background
 * larger than 2px, and never the sole carrier of meaning).
 */
function SealMark({ policy }: SealMarkProps) {
  const label = `Sealed — ${policy}`;
  return (
    <span
      role="img"
      aria-label={label}
      title={label}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 'var(--space-1)',
        flexShrink: 0,
        color: 'var(--sealed)',
        fontFamily: 'var(--font-ui)',
        fontSize: 'var(--t-11)',
        lineHeight: 'var(--t-11--line-height)',
        fontWeight: 500,
      }}
    >
      {LOCK_GLYPH}
      Sealed
    </span>
  );
}

function DocumentMeta({ document: doc }: { document: DocumentSummary }) {
  const items = [
    doc.kind,
    doc.version,
    doc.indexed ? 'Indexed' : 'Not indexed',
    doc.classification,
    formatPageCount(doc.pages),
  ];
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: 'var(--space-2)',
        color: 'var(--text-dim)',
        fontSize: 'var(--t-12)',
        lineHeight: 'var(--t-12--line-height)',
      }}
    >
      {items.map((item, index) => (
        <span key={item} style={{ display: 'inline-flex', gap: 'var(--space-2)' }}>
          {index > 0 ? <span aria-hidden="true">·</span> : null}
          <span
            style={{
              fontFamily: index === 1 || index === 4 ? 'var(--font-mono)' : 'var(--font-ui)',
              fontVariantNumeric: 'tabular-nums',
            }}
          >
            {item}
          </span>
        </span>
      ))}
    </span>
  );
}

interface DocumentItemProps {
  document: DocumentSummary;
  view: SourcesView;
  hovered: boolean;
  onHoverChange: (id: string | null) => void;
  onOpen: (id: string) => void;
}

function DocumentItem({ document: doc, view, hovered, onHoverChange, onOpen }: DocumentItemProps) {
  const { onFocus, onBlur, ringStyle } = useFocusRing();
  const reduced = prefersReducedMotion();
  const isGrid = view === 'grid';
  const edge = hovered ? 'var(--line-strong)' : 'var(--line)';

  return (
    <li
      onMouseEnter={() => onHoverChange(doc.id)}
      onMouseLeave={() => onHoverChange(null)}
      style={{
        position: 'relative',
        display: 'flex',
        flexDirection: isGrid ? 'column' : 'row',
        alignItems: isGrid ? 'stretch' : 'center',
        justifyContent: 'space-between',
        gap: 'var(--space-4)',
        minHeight: isGrid ? 88 : 40,
        padding: isGrid ? 'var(--space-5)' : 'var(--space-3) var(--space-4)',
        background: hovered ? 'var(--hover)' : 'var(--raised)',
        // Cards do not float (3.4): a hairline at rest, --line-strong when active.
        border: `1px solid ${edge}`,
        // Signal colour as a 2px left rule only - never a panel fill.
        borderLeft: doc.sealed ? '2px solid var(--sealed)' : `1px solid ${edge}`,
        borderRadius: isGrid ? 'var(--r-md)' : 'var(--r-sm)',
        transition: reduced
          ? 'none'
          : 'background var(--m-ui) var(--ease-ui), border-color var(--m-ui) var(--ease-ui)',
      }}
    >
      <button
        type="button"
        onClick={() => onOpen(doc.id)}
        onFocus={onFocus}
        onBlur={onBlur}
        style={{
          flex: '1 1 auto',
          minWidth: 0,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'flex-start',
          gap: 'var(--space-2)',
          padding: 0,
          background: 'transparent',
          border: 'none',
          borderRadius: 'var(--r-sm)',
          color: 'var(--text)',
          font: 'inherit',
          textAlign: 'left',
          cursor: 'pointer',
          ...ringStyle,
        }}
      >
        <span
          style={{
            maxWidth: '100%',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            color: 'var(--text-hi)',
            fontSize: 'var(--t-14)',
            lineHeight: 'var(--t-14--line-height)',
            fontWeight: 500,
          }}
        >
          {doc.title}
        </span>
        <DocumentMeta document={doc} />
      </button>
      {doc.sealed ? (
        <span
          style={
            isGrid
              ? { position: 'absolute', top: 'var(--space-4)', right: 'var(--space-4)' }
              : { flexShrink: 0 }
          }
        >
          <SealMark policy={doc.sealedPolicy ?? UNNAMED_POLICY} />
        </span>
      ) : null}
    </li>
  );
}

function ViewToggleButton({
  label,
  pressed,
  onPress,
  glyph,
}: {
  label: string;
  pressed: boolean;
  onPress: () => void;
  glyph: ReactNode;
}) {
  const { onFocus, onBlur, ringStyle } = useFocusRing();
  return (
    <button
      type="button"
      aria-label={label}
      aria-pressed={pressed}
      onClick={onPress}
      onFocus={onFocus}
      onBlur={onBlur}
      style={{
        width: 28,
        height: 28,
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: pressed ? 'var(--raised)' : 'transparent',
        border: `1px solid ${pressed ? 'var(--line-strong)' : 'var(--line)'}`,
        borderRadius: 'var(--r-sm)',
        color: pressed ? 'var(--text-hi)' : 'var(--text-dim)',
        cursor: 'pointer',
        ...ringStyle,
      }}
    >
      {glyph}
    </button>
  );
}

function ViewToggle({
  view,
  onViewChange,
}: {
  view: SourcesView;
  onViewChange: (view: SourcesView) => void;
}) {
  return (
    <div
      role="group"
      aria-label="Library layout"
      style={{ display: 'inline-flex', gap: 'var(--space-2)' }}
    >
      <ViewToggleButton
        label="List view"
        pressed={view === 'list'}
        onPress={() => onViewChange('list')}
        glyph={
          <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true">
            <rect x="1" y="2" width="10" height="1.4" fill="currentColor" />
            <rect x="1" y="5.3" width="10" height="1.4" fill="currentColor" />
            <rect x="1" y="8.6" width="10" height="1.4" fill="currentColor" />
          </svg>
        }
      />
      <ViewToggleButton
        label="Grid view"
        pressed={view === 'grid'}
        onPress={() => onViewChange('grid')}
        glyph={
          <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true">
            <rect x="1" y="1" width="4.2" height="4.2" fill="currentColor" />
            <rect x="6.8" y="1" width="4.2" height="4.2" fill="currentColor" />
            <rect x="1" y="6.8" width="4.2" height="4.2" fill="currentColor" />
            <rect x="6.8" y="6.8" width="4.2" height="4.2" fill="currentColor" />
          </svg>
        }
      />
    </div>
  );
}

function EmptyState({ onAddSource }: { onAddSource?: () => void }) {
  const { onFocus, onBlur, ringStyle } = useFocusRing();
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'flex-start',
        gap: 'var(--space-4)',
        padding: 'var(--space-7)',
        background: 'var(--surface)',
        border: '1px solid var(--line)',
        borderRadius: 'var(--r-md)',
      }}
    >
      <p
        style={{
          margin: 0,
          color: 'var(--text-dim)',
          fontSize: 'var(--t-13)',
          lineHeight: 'var(--t-13--line-height)',
        }}
      >
        No documents indexed yet. Add a scan, a datasheet, or a historian export and INDRA will
        index it on this machine.
      </p>
      <button
        type="button"
        onClick={onAddSource}
        onFocus={onFocus}
        onBlur={onBlur}
        style={{
          height: 28,
          padding: '0 var(--space-5)',
          background: 'transparent',
          border: '1px solid var(--line-strong)',
          borderRadius: 'var(--r-sm)',
          color: 'var(--text-hi)',
          fontFamily: 'var(--font-ui)',
          fontSize: 'var(--t-13)',
          fontWeight: 500,
          cursor: 'pointer',
          ...ringStyle,
        }}
      >
        Add a source
      </button>
    </div>
  );
}

export function SourcesLibrary({
  documents,
  view,
  onOpen,
  onViewChange,
  onAddSource,
}: SourcesLibraryProps) {
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const sealedCount = documents.filter((doc) => doc.sealed).length;

  return (
    <section
      aria-label="Document library"
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
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 'var(--space-4)',
          paddingBottom: 'var(--space-3)',
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
          {documents.length === 1 ? '1 document' : `${documents.length} documents`}
          {sealedCount > 0 ? ` · ${sealedCount} sealed` : ''}
        </span>
        <ViewToggle view={view} onViewChange={onViewChange} />
      </header>

      {documents.length === 0 ? (
        <EmptyState onAddSource={onAddSource} />
      ) : (
        <ul
          style={{
            listStyle: 'none',
            margin: 0,
            padding: 0,
            display: view === 'grid' ? 'grid' : 'flex',
            flexDirection: view === 'grid' ? undefined : 'column',
            gridTemplateColumns:
              view === 'grid' ? 'repeat(auto-fill, minmax(220px, 1fr))' : undefined,
            gap: 'var(--space-2)',
          }}
        >
          {documents.map((doc) => (
            <DocumentItem
              key={doc.id}
              document={doc}
              view={view}
              hovered={hoveredId === doc.id}
              onHoverChange={setHoveredId}
              onOpen={onOpen}
            />
          ))}
        </ul>
      )}
    </section>
  );
}
