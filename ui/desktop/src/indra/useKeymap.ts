import { useEffect } from 'react';
import type { IndraRailDestination } from '../components/indra-shell/IndraRail';

const RAIL_DESTINATIONS_BY_DIGIT: Record<string, IndraRailDestination> = {
  '1': 'work',
  '2': 'memory',
  '3': 'sources',
  '4': 'trace',
  '5': 'sovereignty',
};

export interface KeymapHandlers {
  onOpenPalette?: () => void;
  onToggleLock?: () => void;
  onToggleSheet?: () => void;
  onOpenContextLedger?: () => void;
  onSelectDestination?: (destination: IndraRailDestination) => void;
  /** Only called if a generation is actually in flight. */
  onStopGeneration?: () => void;
  onCloseSheet?: () => void;
  onClearSelection?: () => void;
  onSend?: () => void;
  onFindInTranscript?: () => void;
  onPreviousCitation?: () => void;
  onNextCitation?: () => void;
  onExportRun?: () => void;
  /** True while a turn is generating — governs Esc's first rung. */
  isGenerating?: boolean;
  /** True while a sheet is open — governs Esc's second rung. */
  isSheetOpen?: boolean;
  /** True while something is selected — governs Esc's third rung. */
  hasSelection?: boolean;
}

// Accepts either modifier rather than branching on platform detection: ⌘ on
// macOS, Ctrl elsewhere, and either one works regardless — simpler and more
// forgiving than a platform sniff that a test environment won't match anyway.
function isModified(event: KeyboardEvent): boolean {
  return event.metaKey || event.ctrlKey;
}

/**
 * Spec §7.3, the complete keymap. Esc is ordered, not ambiguous: stop
 * generation first, then close the sheet, then clear selection — each rung
 * only fires when its condition (`isGenerating`/`isSheetOpen`/`hasSelection`)
 * is true, so an Esc with nothing to stop, close, or clear does nothing.
 */
export function useKeymap(handlers: KeymapHandlers): void {
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      const target = event.target as HTMLElement | null;
      const inTextField =
        target instanceof HTMLElement &&
        (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable);

      if (event.key === 'Escape') {
        if (handlers.isGenerating) {
          handlers.onStopGeneration?.();
        } else if (handlers.isSheetOpen) {
          handlers.onCloseSheet?.();
        } else if (handlers.hasSelection) {
          handlers.onClearSelection?.();
        }
        return;
      }

      if (isModified(event) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        handlers.onOpenPalette?.();
        return;
      }

      if (isModified(event) && event.key.toLowerCase() === 'l') {
        event.preventDefault();
        handlers.onToggleLock?.();
        return;
      }

      if (isModified(event) && event.key === '\\') {
        event.preventDefault();
        handlers.onToggleSheet?.();
        return;
      }

      if (isModified(event) && event.shiftKey && event.key.toLowerCase() === 'c') {
        event.preventDefault();
        handlers.onOpenContextLedger?.();
        return;
      }

      if (isModified(event) && event.key.toLowerCase() === 'f') {
        event.preventDefault();
        handlers.onFindInTranscript?.();
        return;
      }

      if (isModified(event) && event.key.toLowerCase() === 'e') {
        event.preventDefault();
        handlers.onExportRun?.();
        return;
      }

      if (isModified(event) && event.key in RAIL_DESTINATIONS_BY_DIGIT) {
        event.preventDefault();
        handlers.onSelectDestination?.(RAIL_DESTINATIONS_BY_DIGIT[event.key]);
        return;
      }

      // The rest are composer/transcript keys: only fire outside a text
      // field's own native handling, except Enter, which a text field is
      // exactly where send/newline are meant to fire from.
      if (isModified(event) && event.key === 'Enter') {
        event.preventDefault();
        handlers.onSend?.();
        return;
      }

      if (!inTextField && event.key === '[') {
        handlers.onPreviousCitation?.();
        return;
      }

      if (!inTextField && event.key === ']') {
        handlers.onNextCitation?.();
      }
    }

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  });
}
