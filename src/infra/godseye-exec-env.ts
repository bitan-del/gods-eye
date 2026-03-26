export const GODSEYE_CLI_ENV_VAR = "GODSEYE_CLI";
export const GODSEYE_CLI_ENV_VALUE = "1";

export function markGodsEyeExecEnv<T extends Record<string, string | undefined>>(env: T): T {
  return {
    ...env,
    [GODSEYE_CLI_ENV_VAR]: GODSEYE_CLI_ENV_VALUE,
  };
}

export function ensureGodsEyeExecMarkerOnProcess(
  env: NodeJS.ProcessEnv = process.env,
): NodeJS.ProcessEnv {
  env[GODSEYE_CLI_ENV_VAR] = GODSEYE_CLI_ENV_VALUE;
  return env;
}
