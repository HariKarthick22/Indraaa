import { renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { useKeymap } from './useKeymap';

function press(key: string, init: KeyboardEventInit = {}) {
  window.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, ...init }));
}

describe('useKeymap — Esc ordering', () => {
  it('stops generation first when a turn is in flight, ignoring the sheet and selection', () => {
    const onStopGeneration = vi.fn();
    const onCloseSheet = vi.fn();
    const onClearSelection = vi.fn();
    renderHook(() =>
      useKeymap({
        isGenerating: true,
        isSheetOpen: true,
        hasSelection: true,
        onStopGeneration,
        onCloseSheet,
        onClearSelection,
      })
    );

    press('Escape');

    expect(onStopGeneration).toHaveBeenCalledOnce();
    expect(onCloseSheet).not.toHaveBeenCalled();
    expect(onClearSelection).not.toHaveBeenCalled();
  });

  it('closes the sheet next once generation has stopped', () => {
    const onCloseSheet = vi.fn();
    const onClearSelection = vi.fn();
    renderHook(() =>
      useKeymap({
        isGenerating: false,
        isSheetOpen: true,
        hasSelection: true,
        onCloseSheet,
        onClearSelection,
      })
    );

    press('Escape');

    expect(onCloseSheet).toHaveBeenCalledOnce();
    expect(onClearSelection).not.toHaveBeenCalled();
  });

  it('clears the selection last once nothing is generating or open', () => {
    const onClearSelection = vi.fn();
    renderHook(() =>
      useKeymap({
        isGenerating: false,
        isSheetOpen: false,
        hasSelection: true,
        onClearSelection,
      })
    );

    press('Escape');

    expect(onClearSelection).toHaveBeenCalledOnce();
  });

  it('does nothing when there is nothing to stop, close, or clear', () => {
    const onStopGeneration = vi.fn();
    const onCloseSheet = vi.fn();
    const onClearSelection = vi.fn();
    renderHook(() =>
      useKeymap({ onStopGeneration, onCloseSheet, onClearSelection })
    );

    press('Escape');

    expect(onStopGeneration).not.toHaveBeenCalled();
    expect(onCloseSheet).not.toHaveBeenCalled();
    expect(onClearSelection).not.toHaveBeenCalled();
  });
});

describe('useKeymap — other bindings', () => {
  it('opens the palette on the platform modifier + K', () => {
    const onOpenPalette = vi.fn();
    renderHook(() => useKeymap({ onOpenPalette }));

    press('k', { metaKey: true });

    expect(onOpenPalette).toHaveBeenCalledOnce();
  });

  it('switches to the rail destination for modifier + digit', () => {
    const onSelectDestination = vi.fn();
    renderHook(() => useKeymap({ onSelectDestination }));

    press('5', { metaKey: true });

    expect(onSelectDestination).toHaveBeenCalledWith('sovereignty');
  });

  it('toggles the right sheet on modifier + backslash', () => {
    const onToggleSheet = vi.fn();
    renderHook(() => useKeymap({ onToggleSheet }));

    press('\\', { metaKey: true });

    expect(onToggleSheet).toHaveBeenCalledOnce();
  });
});
