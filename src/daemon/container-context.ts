export function resolveDaemonContainerContext(
  env: Record<string, string | undefined> = process.env,
): string | null {
  return env.GODSEYE_CONTAINER_HINT?.trim() || env.GODSEYE_CONTAINER?.trim() || null;
}
