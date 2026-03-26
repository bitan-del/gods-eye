import { resolveAgentWorkspaceDir, resolveDefaultAgentId } from "../agents/agent-scope.js";
import { listChannelPlugins, type ChannelPlugin } from "../channels/plugins/index.js";
import { loadGodsEyePlugins } from "../plugins/loader.js";
import { loadConfig, readConfigFileSnapshot } from "./config.js";
import type { GodsEyeConfig } from "./config.js";
import { buildConfigSchema, type ChannelUiMetadata, type ConfigSchemaResponse } from "./schema.js";

const silentSchemaLogger = {
  info: () => {},
  warn: () => {},
  error: () => {},
  debug: () => {},
};

function loadPluginSchemaRegistry(
  config: GodsEyeConfig,
  opts?: {
    activate?: boolean;
    cache?: boolean;
    includeSetupOnlyChannelPlugins?: boolean;
  },
) {
  const workspaceDir = resolveAgentWorkspaceDir(config, resolveDefaultAgentId(config));
  return loadGodsEyePlugins({
    config,
    cache: opts?.cache,
    activate: opts?.activate,
    includeSetupOnlyChannelPlugins: opts?.includeSetupOnlyChannelPlugins,
    workspaceDir,
    runtimeOptions: {
      allowGatewaySubagentBinding: true,
    },
    logger: silentSchemaLogger,
  });
}

function mapPluginSchemaMetadataFromRegistry(
  pluginRegistry: ReturnType<typeof loadGodsEyePlugins>,
) {
  return pluginRegistry.plugins.map((plugin) => ({
    id: plugin.id,
    name: plugin.name,
    description: plugin.description,
    configUiHints: plugin.configUiHints,
    configSchema: plugin.configJsonSchema,
  }));
}

function mapChannelSchemaMetadataFromEntries(
  entries: Array<Pick<ChannelPlugin, "id" | "meta" | "configSchema">>,
): ChannelUiMetadata[] {
  return entries.map((entry) => ({
    id: entry.id,
    label: entry.meta.label,
    description: entry.meta.blurb,
    configSchema: entry.configSchema?.schema,
    configUiHints: entry.configSchema?.uiHints,
  }));
}

function mapActiveChannelSchemaMetadata(): ChannelUiMetadata[] {
  return mapChannelSchemaMetadataFromEntries(listChannelPlugins());
}

function mapChannelSchemaMetadataFromRegistry(
  pluginRegistry: ReturnType<typeof loadGodsEyePlugins>,
) {
  const entries = [
    ...pluginRegistry.channelSetups.map((entry) => entry.plugin),
    ...pluginRegistry.channels.map((entry) => entry.plugin),
  ];
  if (entries.length > 0) {
    const deduped = new Map<string, Pick<ChannelPlugin, "id" | "meta" | "configSchema">>();
    for (const entry of entries) {
      deduped.set(entry.id, entry);
    }
    return mapChannelSchemaMetadataFromEntries([...deduped.values()]);
  }
  return mapActiveChannelSchemaMetadata();
}

export function loadGatewayRuntimeConfigSchema(): ConfigSchemaResponse {
  const cfg = loadConfig();
  const pluginRegistry = loadPluginSchemaRegistry(cfg, { cache: true });
  return buildConfigSchema({
    plugins: mapPluginSchemaMetadataFromRegistry(pluginRegistry),
    channels: mapActiveChannelSchemaMetadata(),
  });
}

function readFallbackChannelSchemaMetadata(): ChannelUiMetadata[] {
  try {
    const pluginRegistry = loadPluginSchemaRegistry(
      {
        plugins: {
          enabled: true,
        },
      },
      {
        activate: false,
        cache: false,
        includeSetupOnlyChannelPlugins: true,
      },
    );
    return mapChannelSchemaMetadataFromRegistry(pluginRegistry);
  } catch {
    return [];
  }
}

export async function readBestEffortRuntimeConfigSchema(): Promise<ConfigSchemaResponse> {
  const snapshot = await readConfigFileSnapshot();

  if (!snapshot.valid) {
    return buildConfigSchema({ channels: readFallbackChannelSchemaMetadata() });
  }

  try {
    const pluginRegistry = loadPluginSchemaRegistry(snapshot.config, {
      activate: false,
      cache: false,
    });
    return buildConfigSchema({
      plugins: mapPluginSchemaMetadataFromRegistry(pluginRegistry),
      channels: mapChannelSchemaMetadataFromRegistry(pluginRegistry),
    });
  } catch {
    return buildConfigSchema({ channels: readFallbackChannelSchemaMetadata() });
  }
}
