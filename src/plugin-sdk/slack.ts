// Manual facade. Keep loader boundary explicit.
type InteractiveRepliesSurface = typeof import("@godseye/slack/interactive-replies-api.js");
type SecuritySurface = typeof import("@godseye/slack/security-contract-api.js");
import { loadBundledPluginPublicSurfaceModuleSync } from "./facade-loader.js";

function loadInteractiveRepliesSurface(): InteractiveRepliesSurface {
  return loadBundledPluginPublicSurfaceModuleSync<InteractiveRepliesSurface>({
    dirName: "slack",
    artifactBasename: "interactive-replies-api.js",
  });
}

function loadSecuritySurface(): SecuritySurface {
  return loadBundledPluginPublicSurfaceModuleSync<SecuritySurface>({
    dirName: "slack",
    artifactBasename: "security-contract-api.js",
  });
}

export const compileSlackInteractiveReplies: InteractiveRepliesSurface["compileSlackInteractiveReplies"] =
  ((...args) =>
    loadInteractiveRepliesSurface().compileSlackInteractiveReplies(
      ...args,
    )) as InteractiveRepliesSurface["compileSlackInteractiveReplies"];

export const collectSlackSecurityAuditFindings: SecuritySurface["collectSlackSecurityAuditFindings"] =
  ((...args) =>
    loadSecuritySurface().collectSlackSecurityAuditFindings(
      ...args,
    )) as SecuritySurface["collectSlackSecurityAuditFindings"];
