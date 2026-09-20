import {
  useCallback,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type FocusEvent,
  type KeyboardEvent,
  type MouseEvent,
} from 'react';

export type MemoryNodeState = 'cached' | 'indexed' | 'evicted' | 'stale';

export interface MemoryNode {
  id: string;
  label: string;
  version: string;
  /** First bytes of the content hash - enough to compare by eye. */
  hashPrefix: string;
  bytes: number;
  /** The ACL that came with the object. */
  acl: string;
  /** ISO date of the most recent citation. */
  lastCited: string;
  /** How many sessions have cited this node. */
  citingSessions: number;
  state: MemoryNodeState;
}

export interface MemoryLedgerProps {
  nodes: MemoryNode[];
  selectedIds: string[];
  onSelectionChange: (ids: string[]) => void;
  /** Floating-bar actions. Spec 5.5 names all three. */
  onAskScope?: (ids: string[]) => void;
  onSaveView?: (ids: string[]) => void;
  onExportRefs?: (ids: string[]) => void;
}

/** Fixed row height, so the window maths stays integer. */
const ROW_HEIGHT = 32;
const HEADER_HEIGHT = 56;
const OVERSCAN = 6;
/**
 * jsdom reports clientHeight 0, and so does any container measured before
 * layout. Falling back to a real viewport keeps the first paint useful instead
 * of empty.
 */
const FALLBACK_VIEWPORT = 480;

export function formatLedgerBytes(bytes: number): string {
  if (bytes < 1000) return `${bytes} B`;
  return `${(bytes / 1000).toFixed(1)} kB`;
}

/**
 * State is a word and a glyph first; colour is the last channel, and only
 * `stale` earns one (3.2: --degraded means "stale cache"). Resisting a hue per
 * state is the point of section 11 - use position and iconography instead.
 */
const STATE_PRESENTATION: Record<MemoryNodeState, { label: string; glyph: string; color: string }> =
  {
    cached: { label: 'Cached', glyph: '⬤', color: 'var(--text-hi)' },
    indexed: { label: 'Indexed', glyph: '○', color: 'var(--text-dim)' },
    evicted: { label: 'Evicted', glyph: '◍', color: 'var(--text-faint)' },
    stale: { label: 'Stale', glyph: '◐', color: 'var(--degraded)' },
  };

type ColumnKey = keyof Omit<MemoryNode, 'id'>;

interface Column {
  key: ColumnKey;
  label: string;
  width: string;
  mono: boolean;
  numeric: boolean;
  align: CSSProperties['textAlign'];
}

const COLUMNS: Column[] = [
  { key: 'label', label: 'Node', width: 'minmax(180px, 2.4fr)', mono: false, numeric: false, align: 'left' },
  { key: 'version', label: 'Version', width: 'minmax(64px, 0.6fr)', mono: true, numeric: false, align: 'left' },
  { key: 'hashPrefix', label: 'Hash', width: 'minmax(64px, 0.6fr)', mono: true, numeric: false, align: 'left' },
  { key: 'bytes', label: 'Bytes', width: 'minmax(72px, 0.7fr)', mono: true, numeric: true, align: 'right' },
  { key: 'acl', label: 'ACL', width: 'minmax(96px, 1fr)', mono: false, numeric: false, align: 'left' },
  { key: 'lastCited', label: 'Last cited', width: 'minmax(96px, 1fr)', mono: true, numeric: false, align: 'left' },
  { key: 'citingSessions', label: 'Sessions', width: 'minmax(72px, 0.6fr)', mono: true, numeric: true, align: 'right' },
  { key: 'state', label: 'State', width: 'minmax(96px, 0.8fr)', mono: false, numeric: false, align: 'left' },
];

const GRID_TEMPLATE = COLUMNS.map((column) => column.width).join(' ');

type SortDirection = 'ascending' | 'descending';

interface SortState {
  key: ColumnKey;
  direction: SortDirection;
}

/** The text a cell shows, and the text its filter matches against. */
function cellText(node: MemoryNode, key: ColumnKey): string {
  if (key === 'bytes') return formatLedgerBytes(node.bytes);
  if (key === 'citingSessions') return String(node.citingSessions);
  if (key === 'state') return STATE_PRESENTATION[node.state].label;
  return String(node[key]);
}

function compare(a: MemoryNode, b: MemoryNode, key: ColumnKey): number {
  const left = a[key];
  const right = b[key];
  if (typeof left === 'number' && typeof right === 'number') return left - right;
  return String(left).localeCompare(String(right));
}

/**
 * Focus ring, per section 8: 2px var(--focus) at 2px offset, never removed for
 * mouse users. Inline styles cannot express :focus-visible, so focus is held
 * in state and the ring is always drawn on focus.
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

const CELL_PADDING = '0 var(--space-3)';

function HeaderCell({
  column,
  sort,
  filter,
  onSort,
  onFilterChange,
}: {
  column: Column;
  sort: SortState | null;
  filter: string;
  onSort: (key: ColumnKey) => void;
  onFilterChange: (key: ColumnKey, value: string) => void;
}) {
  const sortRing = useFocusRing();
  const filterRing = useFocusRing();
  const activeSort = sort && sort.key === column.key ? sort : null;
  const active = activeSort !== null;
  const ariaSort = activeSort ? activeSort.direction : 'none';
  const marker = !activeSort ? '' : activeSort.direction === 'ascending' ? '↑' : '↓';

  return (
    <div
      role="columnheader"
      aria-sort={ariaSort}
      style={{
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        gap: 'var(--space-1)',
        minWidth: 0,
        padding: 'var(--space-2) var(--space-3)',
        textAlign: column.align,
      }}
    >
      <button
        type="button"
        onClick={() => onSort(column.key)}
        onFocus={sortRing.onFocus}
        onBlur={sortRing.onBlur}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: column.align === 'right' ? 'flex-end' : 'flex-start',
          gap: 'var(--space-2)',
          padding: 0,
          background: 'transparent',
          border: 'none',
          borderRadius: 'var(--r-sm)',
          color: active ? 'var(--text-hi)' : 'var(--text-dim)',
          fontFamily: 'var(--font-ui)',
          fontSize: 'var(--t-12)',
          lineHeight: 'var(--t-12--line-height)',
          fontWeight: 500,
          cursor: 'pointer',
          ...sortRing.ringStyle,
        }}
      >
        {column.label}
        <span aria-hidden="true" style={{ color: 'var(--text-faint)' }}>
          {marker}
        </span>
      </button>
      <input
        type="text"
        value={filter}
        aria-label={`Filter ${column.label}`}
        onChange={(event) => onFilterChange(column.key, event.target.value)}
        onFocus={filterRing.onFocus}
        onBlur={filterRing.onBlur}
        style={{
          width: '100%',
          minWidth: 0,
          height: 20,
          padding: '0 var(--space-2)',
          background: 'var(--bg)',
          border: '1px solid var(--line)',
          borderRadius: 'var(--r-sm)',
          color: 'var(--text)',
          caretColor: 'var(--focus)',
          fontFamily: column.mono ? 'var(--font-mono)' : 'var(--font-ui)',
          fontSize: 'var(--t-11)',
          lineHeight: 'var(--t-11--line-height)',
          fontVariantNumeric: 'tabular-nums',
          textAlign: column.align,
          ...filterRing.ringStyle,
        }}
      />
    </div>
  );
}

function StateCell({ state }: { state: MemoryNodeState }) {
  const presentation = STATE_PRESENTATION[state];
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 'var(--space-2)' }}>
      <span aria-hidden="true" style={{ color: presentation.color, fontSize: 'var(--t-11)' }}>
        {presentation.glyph}
      </span>
      {presentation.label}
    </span>
  );
}

interface LedgerRowProps {
  node: MemoryNode;
  rowIndex: number;
  selected: boolean;
  focused: boolean;
  top: number;
  reducedMotion: boolean;
  onRowClick: (index: number, event: MouseEvent<HTMLDivElement>) => void;
  onRowKeyDown: (index: number, event: KeyboardEvent<HTMLDivElement>) => void;
}

function LedgerRow({
  node,
  rowIndex,
  selected,
  focused,
  top,
  reducedMotion,
  onRowClick,
  onRowKeyDown,
}: LedgerRowProps) {
  const [hovered, setHovered] = useState(false);
  return (
    <div
      role="row"
      aria-rowindex={rowIndex + 2}
      aria-selected={selected}
      tabIndex={focused ? 0 : -1}
      onClick={(event) => onRowClick(rowIndex, event)}
      onKeyDown={(event) => onRowKeyDown(rowIndex, event)}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        position: 'absolute',
        top,
        left: 0,
        right: 0,
        height: ROW_HEIGHT,
        display: 'grid',
        gridTemplateColumns: GRID_TEMPLATE,
        alignItems: 'center',
        background: selected ? 'var(--raised)' : hovered ? 'var(--hover)' : 'transparent',
        borderBottom: '1px solid var(--line)',
        // Selection reads as a 2px rule, not a filled band.
        borderLeft: `2px solid ${selected ? 'var(--text-hi)' : 'transparent'}`,
        color: selected ? 'var(--text-hi)' : 'var(--text)',
        fontSize: 'var(--t-12)',
        lineHeight: 'var(--t-12--line-height)',
        cursor: 'pointer',
        outline: focused ? '2px solid var(--focus)' : 'none',
        outlineOffset: '-2px',
        transition: reducedMotion ? 'none' : 'background var(--m-ui) var(--ease-ui)',
      }}
    >
      {COLUMNS.map((column) => (
        <div
          key={column.key}
          role="cell"
          title={column.key === 'label' ? node.label : undefined}
          style={{
            minWidth: 0,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            padding: CELL_PADDING,
            textAlign: column.align,
            fontFamily: column.mono ? 'var(--font-mono)' : 'var(--font-ui)',
            // Tabular numerals so byte and session columns never jitter (3.3).
            fontVariantNumeric: 'tabular-nums',
            fontWeight: column.key === 'label' ? 500 : 400,
            color: column.key === 'label' ? 'var(--text-hi)' : undefined,
          }}
        >
          {column.key === 'state' ? <StateCell state={node.state} /> : cellText(node, column.key)}
        </div>
      ))}
    </div>
  );
}

function BarButton({ label, onPress }: { label: string; onPress: () => void }) {
  const { onFocus, onBlur, ringStyle } = useFocusRing();
  return (
    <button
      type="button"
      onClick={onPress}
      onFocus={onFocus}
      onBlur={onBlur}
      style={{
        height: 24,
        padding: '0 var(--space-3)',
        background: 'transparent',
        border: 'none',
        borderRadius: 'var(--r-sm)',
        color: 'var(--text-hi)',
        fontFamily: 'var(--font-ui)',
        fontSize: 'var(--t-12)',
        lineHeight: 'var(--t-12--line-height)',
        fontWeight: 500,
        cursor: 'pointer',
        ...ringStyle,
      }}
    >
      {label}
    </button>
  );
}

function Separator() {
  return (
    <span aria-hidden="true" style={{ color: 'var(--text-faint)' }}>
      ·
    </span>
  );
}

/**
 * The same floating bar the constellation lasso produces (5.5), so the Ledger
 * is a peer view rather than a fallback (section 8).
 */
function SelectionBar({
  count,
  onAsk,
  onSave,
  onExport,
}: {
  count: number;
  onAsk: () => void;
  onSave: () => void;
  onExport: () => void;
}) {
  return (
    <div
      role="toolbar"
      aria-label="Selection actions"
      style={{
        position: 'absolute',
        left: '50%',
        bottom: 'var(--space-6)',
        transform: 'translateX(-50%)',
        display: 'flex',
        alignItems: 'center',
        gap: 'var(--space-2)',
        height: 36,
        padding: '0 var(--space-4)',
        background: 'var(--raised)',
        border: '1px solid var(--line-strong)',
        borderRadius: 'var(--r-md)',
        color: 'var(--text)',
        fontFamily: 'var(--font-ui)',
        fontSize: 'var(--t-12)',
        lineHeight: 'var(--t-12--line-height)',
        whiteSpace: 'nowrap',
      }}
    >
      <span style={{ fontVariantNumeric: 'tabular-nums', color: 'var(--text-hi)', fontWeight: 500 }}>
        {count === 1 ? '1 node selected' : `${count} nodes selected`}
      </span>
      <Separator />
      <BarButton label="Ask about this scope" onPress={onAsk} />
      <Separator />
      <BarButton label="Save as view" onPress={onSave} />
      <Separator />
      <BarButton label="Export refs" onPress={onExport} />
    </div>
  );
}

function EmptyState() {
  return (
    <div
      style={{
        padding: 'var(--space-7)',
        color: 'var(--text-dim)',
        fontSize: 'var(--t-13)',
        lineHeight: 'var(--t-13--line-height)',
      }}
    >
      No memory nodes yet. Index a document in Sources and it will appear here the first time a
      session cites it.
    </div>
  );
}

export function MemoryLedger({
  nodes,
  selectedIds,
  onSelectionChange,
  onAskScope,
  onSaveView,
  onExportRefs,
}: MemoryLedgerProps) {
  const [sort, setSort] = useState<SortState | null>(null);
  const [filters, setFilters] = useState<Partial<Record<ColumnKey, string>>>({});
  const [scrollTop, setScrollTop] = useState(0);
  const [viewportHeight, setViewportHeight] = useState(FALLBACK_VIEWPORT);
  const [focusedIndex, setFocusedIndex] = useState(0);
  const anchorRef = useRef<number | null>(null);
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const reducedMotion = prefersReducedMotion();

  useLayoutEffect(() => {
    const measured = viewportRef.current?.clientHeight ?? 0;
    if (measured > 0) setViewportHeight(measured);
  }, []);

  const filtered = useMemo(() => {
    const active = COLUMNS.filter((column) => (filters[column.key] ?? '').trim().length > 0);
    if (active.length === 0) return nodes;
    return nodes.filter((node) =>
      active.every((column) =>
        cellText(node, column.key)
          .toLowerCase()
          .includes((filters[column.key] ?? '').trim().toLowerCase())
      )
    );
  }, [nodes, filters]);

  const rows = useMemo(() => {
    if (!sort) return filtered;
    const sorted = [...filtered].sort((a, b) => compare(a, b, sort.key));
    return sort.direction === 'descending' ? sorted.reverse() : sorted;
  }, [filtered, sort]);

  const selected = useMemo(() => new Set(selectedIds), [selectedIds]);

  const handleSort = useCallback((key: ColumnKey) => {
    setSort((current) =>
      current?.key === key
        ? { key, direction: current.direction === 'ascending' ? 'descending' : 'ascending' }
        : { key, direction: 'ascending' }
    );
  }, []);

  const handleFilterChange = useCallback((key: ColumnKey, value: string) => {
    setFilters((current) => ({ ...current, [key]: value }));
    setScrollTop(0);
  }, []);

  const rangeIds = useCallback(
    (from: number, to: number) => {
      const start = Math.min(from, to);
      const end = Math.max(from, to);
      return rows.slice(start, end + 1).map((node) => node.id);
    },
    [rows]
  );

  const anchorIndex = useCallback(() => {
    if (anchorRef.current !== null) return anchorRef.current;
    if (selectedIds.length > 0) {
      const found = rows.findIndex((node) => node.id === selectedIds[0]);
      if (found >= 0) return found;
    }
    return focusedIndex;
  }, [focusedIndex, rows, selectedIds]);

  const handleRowClick = useCallback(
    (index: number, event: MouseEvent<HTMLDivElement>) => {
      const node = rows[index];
      if (!node) return;
      setFocusedIndex(index);
      if (event.shiftKey) {
        onSelectionChange(rangeIds(anchorIndex(), index));
        return;
      }
      if (event.metaKey || event.ctrlKey) {
        anchorRef.current = index;
        onSelectionChange(
          selected.has(node.id)
            ? selectedIds.filter((id) => id !== node.id)
            : [...selectedIds, node.id]
        );
        return;
      }
      anchorRef.current = index;
      onSelectionChange([node.id]);
    },
    [anchorIndex, onSelectionChange, rangeIds, rows, selected, selectedIds]
  );

  const handleRowKeyDown = useCallback(
    (index: number, event: KeyboardEvent<HTMLDivElement>) => {
      if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp' && event.key !== ' ') return;
      event.preventDefault();

      if (event.key === ' ') {
        const node = rows[index];
        if (!node) return;
        anchorRef.current = index;
        onSelectionChange(
          selected.has(node.id)
            ? selectedIds.filter((id) => id !== node.id)
            : [...selectedIds, node.id]
        );
        return;
      }

      const next = event.key === 'ArrowDown' ? index + 1 : index - 1;
      if (next < 0 || next >= rows.length) return;
      setFocusedIndex(next);
      setScrollTop((current) => {
        const rowTop = next * ROW_HEIGHT;
        if (rowTop < current) return rowTop;
        if (rowTop + ROW_HEIGHT > current + viewportHeight) {
          return rowTop + ROW_HEIGHT - viewportHeight;
        }
        return current;
      });
      if (event.shiftKey) {
        onSelectionChange(rangeIds(anchorIndex(), next));
        return;
      }
      anchorRef.current = next;
      onSelectionChange([rows[next].id]);
    },
    [anchorIndex, onSelectionChange, rangeIds, rows, selected, selectedIds, viewportHeight]
  );

  // Virtualisation: only the visible window plus an overscan is mounted. A
  // plant corpus is 50k nodes; a DOM row each is not survivable.
  const first = Math.max(0, Math.floor(scrollTop / ROW_HEIGHT) - OVERSCAN);
  const last = Math.min(
    rows.length,
    Math.ceil((scrollTop + viewportHeight) / ROW_HEIGHT) + OVERSCAN
  );
  const windowed = rows.slice(first, last);

  return (
    <section
      aria-label="Memory ledger"
      style={{
        position: 'relative',
        display: 'flex',
        flexDirection: 'column',
        minHeight: 0,
        height: '100%',
        width: '100%',
        background: 'var(--surface)',
        border: '1px solid var(--line)',
        borderRadius: 'var(--r-md)',
        color: 'var(--text)',
        fontFamily: 'var(--font-ui)',
      }}
    >
      <div
        role="table"
        aria-label="Memory nodes"
        aria-rowcount={rows.length + 1}
        aria-colcount={COLUMNS.length}
        style={{ display: 'flex', flexDirection: 'column', minHeight: 0, flex: '1 1 auto' }}
      >
        <div role="rowgroup" style={{ flexShrink: 0 }}>
          <div
            role="row"
            aria-rowindex={1}
            style={{
              display: 'grid',
              gridTemplateColumns: GRID_TEMPLATE,
              alignItems: 'stretch',
              height: HEADER_HEIGHT,
              // The 2px selection rule on data rows needs a matching gutter.
              borderLeft: '2px solid transparent',
              borderBottom: '1px solid var(--line-strong)',
            }}
          >
            {COLUMNS.map((column) => (
              <HeaderCell
                key={column.key}
                column={column}
                sort={sort}
                filter={filters[column.key] ?? ''}
                onSort={handleSort}
                onFilterChange={handleFilterChange}
              />
            ))}
          </div>
        </div>

        <div
          ref={viewportRef}
          role="rowgroup"
          onScroll={(event) => setScrollTop(event.currentTarget.scrollTop)}
          style={{ flex: '1 1 auto', minHeight: 0, overflowY: 'auto', position: 'relative' }}
        >
          {rows.length === 0 ? (
            <EmptyState />
          ) : (
            <div style={{ position: 'relative', height: rows.length * ROW_HEIGHT }}>
              {windowed.map((node, offset) => {
                const index = first + offset;
                return (
                  <LedgerRow
                    key={node.id}
                    node={node}
                    rowIndex={index}
                    selected={selected.has(node.id)}
                    focused={index === focusedIndex}
                    top={index * ROW_HEIGHT}
                    reducedMotion={reducedMotion}
                    onRowClick={handleRowClick}
                    onRowKeyDown={handleRowKeyDown}
                  />
                );
              })}
            </div>
          )}
        </div>
      </div>

      {selectedIds.length > 0 ? (
        <SelectionBar
          count={selectedIds.length}
          onAsk={() => onAskScope?.(selectedIds)}
          onSave={() => onSaveView?.(selectedIds)}
          onExport={() => onExportRefs?.(selectedIds)}
        />
      ) : null}
    </section>
  );
}
