import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

type NavigationModule = typeof import("./navigation.ts");

function createStorageMock(): Storage {
  const store = new Map<string, string>();
  return {
    get length() {
      return store.size;
    },
    clear() {
      store.clear();
    },
    getItem(key: string) {
      return store.get(key) ?? null;
    },
    key(index: number) {
      return Array.from(store.keys())[index] ?? null;
    },
    removeItem(key: string) {
      store.delete(key);
    },
    setItem(key: string, value: string) {
      store.set(key, String(value));
    },
  };
}

describe("TAB_GROUPS", () => {
  let navigation: NavigationModule;

  beforeEach(async () => {
    vi.resetModules();
    vi.stubGlobal("localStorage", createStorageMock());
    vi.stubGlobal("navigator", { language: "en-US" } as Navigator);
    navigation = await import("./navigation.ts");
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("groups all advanced tabs under the advanced label", () => {
    const advanced = navigation.TAB_GROUPS.find((group) => group.label === "advanced");
    expect(advanced?.tabs).toContain("config");
    expect(advanced?.tabs).toContain("overview");
    expect(advanced?.tabs).toContain("agents");
    expect(advanced?.tabs).toContain("nodes");
    expect(advanced?.tabs).toContain("debug");
    expect(advanced?.tabs).toContain("logs");
  });

  it("routes every published settings slice", () => {
    expect(navigation.tabFromPath("/communications")).toBe("communications");
    expect(navigation.tabFromPath("/appearance")).toBe("appearance");
    expect(navigation.tabFromPath("/automation")).toBe("automation");
    expect(navigation.tabFromPath("/infrastructure")).toBe("infrastructure");
    expect(navigation.tabFromPath("/ai-agents")).toBe("aiAgents");
    expect(navigation.tabFromPath("/config")).toBe("config");
  });
});
