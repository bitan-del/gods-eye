import fs from "node:fs";
import type { ChannelLegacyStateMigrationPlan } from "godseye/plugin-sdk/channel-contract";
import { resolveChannelAllowFromPath } from "godseye/plugin-sdk/channel-pairing";
import type { OpenClawConfig } from "godseye/plugin-sdk/config-runtime";
import { resolveDefaultTelegramAccountId } from "./accounts.js";

function fileExists(pathValue: string): boolean {
  try {
    return fs.existsSync(pathValue) && fs.statSync(pathValue).isFile();
  } catch {
    return false;
  }
}

export function detectTelegramLegacyStateMigrations(params: {
  cfg: OpenClawConfig;
  env: NodeJS.ProcessEnv;
}): ChannelLegacyStateMigrationPlan[] {
  const legacyPath = resolveChannelAllowFromPath("telegram", params.env);
  if (!fileExists(legacyPath)) {
    return [];
  }
  const accountId = resolveDefaultTelegramAccountId(params.cfg);
  const targetPath = resolveChannelAllowFromPath("telegram", params.env, accountId);
  if (fileExists(targetPath)) {
    return [];
  }
  return [
    {
      kind: "copy",
      label: "Telegram pairing allowFrom",
      sourcePath: legacyPath,
      targetPath,
    },
  ];
}
