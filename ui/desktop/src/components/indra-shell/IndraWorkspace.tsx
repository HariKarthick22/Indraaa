import { useState } from 'react';
import { IndraShell } from './IndraShell';
import type { IndraRailDestination } from './IndraRail';

const DESTINATION_TITLES: Record<IndraRailDestination, string> = {
  work: 'Work',
  memory: 'Memory',
  sources: 'Sources',
  trace: 'Trace',
  sovereignty: 'Sovereignty',
};

export function IndraWorkspace() {
  const [active, setActive] = useState<IndraRailDestination>('work');
  const [sessionTitle, setSessionTitle] = useState('New session');

  const toggleTheme = () => {
    document.documentElement.classList.toggle('light');
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
    >
      <h1 style={{ fontSize: 'var(--t-20)', fontWeight: 600, color: 'var(--text-hi)' }}>
        {DESTINATION_TITLES[active]}
      </h1>
    </IndraShell>
  );
}
