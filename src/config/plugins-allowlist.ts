import type { GodsEyeConfig } from "./config.js";

export function ensurePluginAllowlisted(cfg: GodsEyeConfig, pluginId: string): GodsEyeConfig {
  const allow = cfg.plugins?.allow;
  if (!Array.isArray(allow) || allow.includes(pluginId)) {
    return cfg;
  }
  return {
    ...cfg,
    plugins: {
      ...cfg.plugins,
      allow: [...allow, pluginId],
    },
  };
}
