import { listSkillCommandsForAgents as listSkillCommandsForAgentsImpl } from "godseye/plugin-sdk/command-auth";

type ListSkillCommandsForAgents =
  typeof import("godseye/plugin-sdk/command-auth").listSkillCommandsForAgents;

export function listSkillCommandsForAgents(
  ...args: Parameters<ListSkillCommandsForAgents>
): ReturnType<ListSkillCommandsForAgents> {
  return listSkillCommandsForAgentsImpl(...args);
}
