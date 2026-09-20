import { useEffect, useState } from 'react';
import type { AvailableCommand } from '@aaif/goose-acp-client';
import { getAcpClient } from '../acp/acpConnection';
import type { PaletteEntry } from './paletteIndex';

export interface SkillCommand {
  name: string;
  description: string;
}

function commandType(command: AvailableCommand): unknown {
  return command._meta?.['commandType'];
}

function isSkillCommand(command: AvailableCommand): boolean {
  return commandType(command) === 'Skill';
}

function toSkillCommand(command: AvailableCommand): SkillCommand {
  return { name: command.name, description: command.description };
}

/**
 * Reads the skill registry that already turns installed skills into slash
 * commands (crates/indra/src/slash_commands/skill_slash_command.rs) over the
 * existing `ListSlashCommandsRequest` ACP method - this hook surfaces that
 * list, it does not maintain one.
 */
export function useSkillCommands(): SkillCommand[] {
  const [commands, setCommands] = useState<SkillCommand[]>([]);

  useEffect(() => {
    let cancelled = false;

    getAcpClient()
      .then((client) => client.goose.slashCommandsList_unstable({}))
      .then((response) => {
        if (cancelled) return;
        setCommands(response.availableCommands.filter(isSkillCommand).map(toSkillCommand));
      })
      .catch((error) => {
        console.error('Failed to fetch skill slash commands:', error);
        if (!cancelled) setCommands([]);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  return commands;
}

/**
 * Each skill command is also a peer entry in the ⌘K palette (kind: 'skill'),
 * matching the id/label shape `buildPaletteIndex` already uses for
 * `PaletteSkillSource` in paletteIndex.ts.
 */
export function skillCommandsToPaletteEntries(
  commands: readonly SkillCommand[],
  onPick: (command: SkillCommand) => void
): PaletteEntry[] {
  return commands.map((command) => ({
    id: `skill:${command.name}`,
    label: `/${command.name}`,
    kind: 'skill',
    hint: command.description,
    run: () => onPick(command),
  }));
}
