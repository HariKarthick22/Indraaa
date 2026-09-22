import type { ReactNode } from 'react';
import { IndraRail, type IndraRailProps } from './IndraRail';
import { IndraTopBar, type IndraTopBarProps } from './IndraTopBar';

export interface IndraShellProps extends IndraRailProps, IndraTopBarProps {
  children: ReactNode;
  /**
   * Skips main's default padding/78ch-cap/scroll wrapper so children can
   * manage their own full-height layout and scrolling — for a chat-style
   * surface (transcript + sticky composer), not the padded document-style
   * panels every other destination uses.
   */
  fullBleed?: boolean;
}

export function IndraShell({
  active,
  onSelect,
  sessionTitle,
  onSessionTitleChange,
  sessionBytes,
  budgetBytes,
  onToggleTheme,
  children,
  fullBleed = false,
}: IndraShellProps) {
  return (
    <div
      style={{
        display: 'flex',
        width: '100%',
        height: '100%',
        background: 'var(--bg)',
        color: 'var(--text)',
        fontFamily: 'var(--font-ui)',
      }}
    >
      <IndraRail active={active} onSelect={onSelect} />
      <div
        style={{
          flex: '1 1 auto',
          minWidth: 0,
          display: 'flex',
          flexDirection: 'column',
          height: '100%',
        }}
      >
        <IndraTopBar
          sessionTitle={sessionTitle}
          onSessionTitleChange={onSessionTitleChange}
          sessionBytes={sessionBytes}
          budgetBytes={budgetBytes}
          onToggleTheme={onToggleTheme}
        />
        <main
          style={
            fullBleed
              ? { flex: '1 1 auto', minHeight: 0, display: 'flex' }
              : {
                  flex: '1 1 auto',
                  minHeight: 0,
                  overflowY: 'auto',
                  display: 'flex',
                  justifyContent: 'center',
                }
          }
        >
          {fullBleed ? (
            children
          ) : (
            <div
              style={{
                width: '100%',
                maxWidth: '78ch',
                padding: 'var(--space-7)',
              }}
            >
              {children}
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
