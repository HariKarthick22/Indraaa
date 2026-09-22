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

interface SpecialistInfoDto {
  name: string;
  description: string;
}

interface ListSpecialistsResponseDto {
  specialists: SpecialistInfoDto[];
}

const SPECIALISTS_LIST_METHOD = '_goose/unstable/specialists/list';

/**
 * The agent loop's real specialist registry
 * (crates/indra/src/agents/specialists/registry.rs), surfaced as `//`
 * agent-picker entries. Called through `ClientContext.request`'s generic
 * overload rather than a generated wrapper - see `acp/sovereignty.ts` for
 * why (this environment's codegen step needs a Rust build + `just`
 * generate-acp-types that isn't runnable here); swap to the generated
 * `client.goose.specialistsList_unstable` once that's been regenerated.
 */
export function useAgentCommands(): SkillCommand[] {
  const [commands, setCommands] = useState<SkillCommand[]>([]);

  useEffect(() => {
    let cancelled = false;

    getAcpClient()
      .then((client) =>
        client.connection.agent.request<ListSpecialistsResponseDto>(SPECIALISTS_LIST_METHOD, {})
      )
      .then((response) => {
        if (cancelled) return;
        setCommands(
          response.specialists.map((specialist) => ({
            name: specialist.name,
            description: specialist.description,
          }))
        );
      })
      .catch((error) => {
        console.error('Failed to fetch specialists:', error);
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
