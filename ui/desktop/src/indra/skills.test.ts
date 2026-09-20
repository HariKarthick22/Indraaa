import { describe, expect, it, vi } from 'vitest';
import { skillCommandsToPaletteEntries, type SkillCommand } from './skills';

const commands: SkillCommand[] = [
  { name: 'ndt-review', description: 'Review an NDT report against allowables' },
  { name: 'pid-trace', description: 'Trace a line on a P&ID' },
];

describe('skillCommandsToPaletteEntries', () => {
  it('maps each command to a skill-kind palette entry with the slash-prefixed label', () => {
    const entries = skillCommandsToPaletteEntries(commands, vi.fn());

    expect(entries).toEqual([
      {
        id: 'skill:ndt-review',
        label: '/ndt-review',
        kind: 'skill',
        hint: 'Review an NDT report against allowables',
        run: expect.any(Function),
      },
      {
        id: 'skill:pid-trace',
        label: '/pid-trace',
        kind: 'skill',
        hint: 'Trace a line on a P&ID',
        run: expect.any(Function),
      },
    ]);
  });

  it('invokes onPick with the matching command when an entry runs', () => {
    const onPick = vi.fn();
    const entries = skillCommandsToPaletteEntries(commands, onPick);

    entries[1].run();

    expect(onPick).toHaveBeenCalledWith(commands[1]);
  });
});
