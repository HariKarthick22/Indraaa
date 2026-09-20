import { useEffect, useRef, type CSSProperties, type ReactNode } from 'react';
import { useReducedMotion } from '../../indra/useReducedMotion';

export type SheetWidth = 380 | 480 | 520;

export interface SheetProps {
  open: boolean;
  width: SheetWidth;
  onClose: () => void;
  title?: string;
  children: ReactNode;
}

const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

// Only one sheet is ever open at once (spec §6.3) - opening a second closes
// whichever was already showing rather than stacking panels.
const openSheets = new Set<() => void>();

/**
 * Shared right-side panel primitive, reused by the context ledger, the
 * source reader, trace replay, and the memory timeline. Width is one of
 * three fixed steps; Esc closes; focus is trapped inside while open and
 * restored to whatever triggered it on close. Reduced motion cuts the
 * slide-and-fade entrance rather than shortening it.
 */
export function Sheet({ open, width, onClose, title, children }: SheetProps) {
  const reducedMotion = useReducedMotion();
  const panelRef = useRef<HTMLDivElement | null>(null);
  const previouslyFocused = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!open) return undefined;

    for (const closeOther of openSheets) {
      if (closeOther !== onClose) closeOther();
    }
    openSheets.add(onClose);

    previouslyFocused.current = document.activeElement as HTMLElement | null;
    panelRef.current?.focus();

    return () => {
      openSheets.delete(onClose);
      previouslyFocused.current?.focus?.();
    };
  }, [open, onClose]);

  useEffect(() => {
    if (!open) return undefined;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onClose();
        return;
      }
      if (event.key !== 'Tab') return;

      const panel = panelRef.current;
      if (!panel) return;
      const focusable = Array.from(panel.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR));
      if (focusable.length === 0) {
        event.preventDefault();
        panel.focus();
        return;
      }

      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      const current = document.activeElement;
      const outsidePanel = !current || !panel.contains(current);

      if (event.shiftKey) {
        if (outsidePanel || current === first) {
          event.preventDefault();
          last.focus();
        }
      } else if (outsidePanel || current === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  const panelStyle: CSSProperties = {
    position: 'fixed',
    top: 0,
    right: 0,
    bottom: 0,
    width,
    display: 'flex',
    flexDirection: 'column',
    background: 'var(--surface)',
    borderLeft: '1px solid var(--line)',
    // A dialog-like panel is one of the two surfaces permitted to lift off
    // the canvas (§3.4).
    boxShadow: 'var(--shadow-pop)',
    color: 'var(--text)',
    fontFamily: 'var(--font-ui)',
    outline: 'none',
    animation: reducedMotion ? 'none' : 'indra-sheet-in var(--m-enter) var(--ease-enter) both',
  };

  return (
    <>
      <div
        data-testid="indra-sheet-backdrop"
        onClick={onClose}
        style={{ position: 'fixed', inset: 0, background: 'rgba(0, 0, 0, 0.32)' }}
      />
      <div ref={panelRef} role="dialog" aria-modal="true" aria-label={title} tabIndex={-1} style={panelStyle}>
        {title ? (
          <header
            style={{
              flexShrink: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              height: 44,
              padding: '0 var(--space-5)',
              borderBottom: '1px solid var(--line)',
            }}
          >
            <span
              style={{
                fontSize: 'var(--t-13)',
                lineHeight: 'var(--t-13--line-height)',
                fontWeight: 500,
                color: 'var(--text-hi)',
              }}
            >
              {title}
            </span>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              style={{
                width: 24,
                height: 24,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                background: 'transparent',
                border: 'none',
                borderRadius: 'var(--r-sm)',
                color: 'var(--text-dim)',
                cursor: 'pointer',
              }}
            >
              <span aria-hidden="true">×</span>
            </button>
          </header>
        ) : null}
        <div style={{ flex: '1 1 auto', minHeight: 0, overflowY: 'auto' }}>{children}</div>
      </div>
    </>
  );
}
