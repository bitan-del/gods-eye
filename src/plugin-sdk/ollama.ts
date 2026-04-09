type FacadeModule = typeof import("@godseye/ollama/api.js");
import { loadBundledPluginPublicSurfaceModuleSync } from "./facade-loader.js";

function loadFacadeModule(): FacadeModule {
  return loadBundledPluginPublicSurfaceModuleSync<FacadeModule>({
    dirName: "ollama",
    artifactBasename: "api.js",
  });
}

export const resolveOllamaApiBase: FacadeModule["resolveOllamaApiBase"] = ((...args) =>
  loadFacadeModule().resolveOllamaApiBase(...args)) as FacadeModule["resolveOllamaApiBase"];
