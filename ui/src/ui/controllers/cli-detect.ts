import type { GatewayBrowserClient } from "../gateway.ts";

export type DetectedCliBinary = {
  id: string;
  command: string;
  available: boolean;
  version: string | null;
  path: string | null;
  mcpSupported: boolean;
  sessionSupported: boolean;
};

export type CliDetectionResult = {
  backends: DetectedCliBinary[];
  detectedAt: number;
};

/** Fetch locally detected CLI backends from the gateway. */
export async function detectCliBackends(
  client: GatewayBrowserClient,
  force = false,
): Promise<CliDetectionResult> {
  try {
    const result = await client.request<CliDetectionResult>("cli.detect", { force });
    return result ?? { backends: [], detectedAt: Date.now() };
  } catch {
    return { backends: [], detectedAt: Date.now() };
  }
}
