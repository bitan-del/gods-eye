import {
  listAgentIds,
  resolveAgentWorkspaceDir,
  resolveDefaultAgentId,
} from "../../agents/agent-scope.js";
import { installSkillFromClawHub, updateSkillsFromClawHub } from "../../agents/skills-clawhub.js";
import { installSkill } from "../../agents/skills-install.js";
import { buildWorkspaceSkillStatus } from "../../agents/skills-status.js";
import { loadWorkspaceSkillEntries, type SkillEntry } from "../../agents/skills.js";
import { listAgentWorkspaceDirs } from "../../agents/workspace-dirs.js";
import type { GodsEyeConfig } from "../../config/config.js";
import { loadConfig, writeConfigFile } from "../../config/config.js";
import {
  fetchClawHubSkillDetail,
  listClawHubPackages,
  searchClawHubSkills,
} from "../../infra/clawhub.js";
import { getRemoteSkillEligibility } from "../../infra/skills-remote.js";
import { normalizeAgentId } from "../../routing/session-key.js";
import { normalizeSecretInput } from "../../utils/normalize-secret-input.js";
import {
  ErrorCodes,
  errorShape,
  formatValidationErrors,
  validateSkillsBinsParams,
  validateSkillsInstallParams,
  validateSkillsStatusParams,
  validateSkillsStoreListParams,
  validateSkillsUpdateParams,
} from "../protocol/index.js";
import type { GatewayRequestHandlers } from "./types.js";

// CJK character detection regex
const CJK_RE = /[\u2E80-\u9FFF\uF900-\uFAFF\uFE30-\uFE4F]/;

/** Translate a single text string from auto-detected language to English via Google Translate. */
async function translateToEnglish(text: string): Promise<string> {
  if (!text || !CJK_RE.test(text)) {
    return text;
  }
  try {
    const url = new URL("https://translate.googleapis.com/translate_a/single");
    url.searchParams.set("client", "gtx");
    url.searchParams.set("sl", "auto");
    url.searchParams.set("tl", "en");
    url.searchParams.set("dt", "t");
    url.searchParams.set("q", text);
    const res = await fetch(url, { signal: AbortSignal.timeout(5000) });
    if (!res.ok) {
      return text;
    }
    const data = (await res.json()) as [Array<[string]>];
    // Response is [[["translated", "original", ...], ...], ...]
    const translated = data?.[0]?.map((seg) => seg[0]).join("") ?? text;
    return translated || text;
  } catch {
    return text;
  }
}

type StoreItem = {
  slug: string;
  displayName: string;
  summary: string;
  score?: number;
  owner?: string;
  updatedAt?: number;
};

/** Auto-translate CJK fields in store items to English, in parallel. */
async function translateStoreItems(items: StoreItem[]): Promise<StoreItem[]> {
  const tasks = items.map(async (item) => {
    const needsNameTranslation = CJK_RE.test(item.displayName);
    const needsSummaryTranslation = CJK_RE.test(item.summary);
    if (!needsNameTranslation && !needsSummaryTranslation) {
      return item;
    }
    const [translatedName, translatedSummary] = await Promise.all([
      needsNameTranslation
        ? translateToEnglish(item.displayName)
        : Promise.resolve(item.displayName),
      needsSummaryTranslation ? translateToEnglish(item.summary) : Promise.resolve(item.summary),
    ]);
    return { ...item, displayName: translatedName, summary: translatedSummary };
  });
  return Promise.all(tasks);
}

function collectSkillBins(entries: SkillEntry[]): string[] {
  const bins = new Set<string>();
  for (const entry of entries) {
    const required = entry.metadata?.requires?.bins ?? [];
    const anyBins = entry.metadata?.requires?.anyBins ?? [];
    const install = entry.metadata?.install ?? [];
    for (const bin of required) {
      const trimmed = bin.trim();
      if (trimmed) {
        bins.add(trimmed);
      }
    }
    for (const bin of anyBins) {
      const trimmed = bin.trim();
      if (trimmed) {
        bins.add(trimmed);
      }
    }
    for (const spec of install) {
      const specBins = spec?.bins ?? [];
      for (const bin of specBins) {
        const trimmed = String(bin).trim();
        if (trimmed) {
          bins.add(trimmed);
        }
      }
    }
  }
  return [...bins].toSorted();
}

export const skillsHandlers: GatewayRequestHandlers = {
  "skills.status": ({ params, respond }) => {
    if (!validateSkillsStatusParams(params)) {
      respond(
        false,
        undefined,
        errorShape(
          ErrorCodes.INVALID_REQUEST,
          `invalid skills.status params: ${formatValidationErrors(validateSkillsStatusParams.errors)}`,
        ),
      );
      return;
    }
    const cfg = loadConfig();
    const agentIdRaw = typeof params?.agentId === "string" ? params.agentId.trim() : "";
    const agentId = agentIdRaw ? normalizeAgentId(agentIdRaw) : resolveDefaultAgentId(cfg);
    if (agentIdRaw) {
      const knownAgents = listAgentIds(cfg);
      if (!knownAgents.includes(agentId)) {
        respond(
          false,
          undefined,
          errorShape(ErrorCodes.INVALID_REQUEST, `unknown agent id "${agentIdRaw}"`),
        );
        return;
      }
    }
    const workspaceDir = resolveAgentWorkspaceDir(cfg, agentId);
    const report = buildWorkspaceSkillStatus(workspaceDir, {
      config: cfg,
      eligibility: { remote: getRemoteSkillEligibility() },
    });
    respond(true, report, undefined);
  },
  "skills.bins": ({ params, respond }) => {
    if (!validateSkillsBinsParams(params)) {
      respond(
        false,
        undefined,
        errorShape(
          ErrorCodes.INVALID_REQUEST,
          `invalid skills.bins params: ${formatValidationErrors(validateSkillsBinsParams.errors)}`,
        ),
      );
      return;
    }
    const cfg = loadConfig();
    const workspaceDirs = listAgentWorkspaceDirs(cfg);
    const bins = new Set<string>();
    for (const workspaceDir of workspaceDirs) {
      const entries = loadWorkspaceSkillEntries(workspaceDir, { config: cfg });
      for (const bin of collectSkillBins(entries)) {
        bins.add(bin);
      }
    }
    respond(true, { bins: [...bins].toSorted() }, undefined);
  },
  "skills.install": async ({ params, respond }) => {
    if (!validateSkillsInstallParams(params)) {
      respond(
        false,
        undefined,
        errorShape(
          ErrorCodes.INVALID_REQUEST,
          `invalid skills.install params: ${formatValidationErrors(validateSkillsInstallParams.errors)}`,
        ),
      );
      return;
    }
    const cfg = loadConfig();
    const workspaceDirRaw = resolveAgentWorkspaceDir(cfg, resolveDefaultAgentId(cfg));
    if (params && typeof params === "object" && "source" in params && params.source === "clawhub") {
      const p = params as {
        source: "clawhub";
        slug: string;
        version?: string;
        force?: boolean;
      };
      const result = await installSkillFromClawHub({
        workspaceDir: workspaceDirRaw,
        slug: p.slug,
        version: p.version,
        force: Boolean(p.force),
      });
      respond(
        result.ok,
        result.ok
          ? {
              ok: true,
              message: `Installed ${result.slug}@${result.version}`,
              stdout: "",
              stderr: "",
              code: 0,
              slug: result.slug,
              version: result.version,
              targetDir: result.targetDir,
            }
          : result,
        result.ok ? undefined : errorShape(ErrorCodes.UNAVAILABLE, result.error),
      );
      return;
    }
    const p = params as {
      name: string;
      installId: string;
      timeoutMs?: number;
    };
    const result = await installSkill({
      workspaceDir: workspaceDirRaw,
      skillName: p.name,
      installId: p.installId,
      timeoutMs: p.timeoutMs,
      config: cfg,
    });
    respond(
      result.ok,
      result,
      result.ok ? undefined : errorShape(ErrorCodes.UNAVAILABLE, result.message),
    );
  },
  "skills.update": async ({ params, respond }) => {
    if (!validateSkillsUpdateParams(params)) {
      respond(
        false,
        undefined,
        errorShape(
          ErrorCodes.INVALID_REQUEST,
          `invalid skills.update params: ${formatValidationErrors(validateSkillsUpdateParams.errors)}`,
        ),
      );
      return;
    }
    if (params && typeof params === "object" && "source" in params && params.source === "clawhub") {
      const p = params as {
        source: "clawhub";
        slug?: string;
        all?: boolean;
      };
      if (!p.slug && !p.all) {
        respond(
          false,
          undefined,
          errorShape(ErrorCodes.INVALID_REQUEST, 'clawhub skills.update requires "slug" or "all"'),
        );
        return;
      }
      if (p.slug && p.all) {
        respond(
          false,
          undefined,
          errorShape(
            ErrorCodes.INVALID_REQUEST,
            'clawhub skills.update accepts either "slug" or "all", not both',
          ),
        );
        return;
      }
      const cfg = loadConfig();
      const workspaceDir = resolveAgentWorkspaceDir(cfg, resolveDefaultAgentId(cfg));
      const results = await updateSkillsFromClawHub({
        workspaceDir,
        slug: p.slug,
      });
      const errors = results.filter((result) => !result.ok);
      respond(
        errors.length === 0,
        {
          ok: errors.length === 0,
          skillKey: p.slug ?? "*",
          config: {
            source: "clawhub",
            results,
          },
        },
        errors.length === 0
          ? undefined
          : errorShape(ErrorCodes.UNAVAILABLE, errors.map((result) => result.error).join("; ")),
      );
      return;
    }
    const p = params as {
      skillKey: string;
      enabled?: boolean;
      apiKey?: string;
      env?: Record<string, string>;
    };
    const cfg = loadConfig();
    const skills = cfg.skills ? { ...cfg.skills } : {};
    const entries = skills.entries ? { ...skills.entries } : {};
    const current = entries[p.skillKey] ? { ...entries[p.skillKey] } : {};
    if (typeof p.enabled === "boolean") {
      current.enabled = p.enabled;
    }
    if (typeof p.apiKey === "string") {
      const trimmed = normalizeSecretInput(p.apiKey);
      if (trimmed) {
        current.apiKey = trimmed;
      } else {
        delete current.apiKey;
      }
    }
    if (p.env && typeof p.env === "object") {
      const nextEnv = current.env ? { ...current.env } : {};
      for (const [key, value] of Object.entries(p.env)) {
        const trimmedKey = key.trim();
        if (!trimmedKey) {
          continue;
        }
        const trimmedVal = value.trim();
        if (!trimmedVal) {
          delete nextEnv[trimmedKey];
        } else {
          nextEnv[trimmedKey] = trimmedVal;
        }
      }
      current.env = nextEnv;
    }
    entries[p.skillKey] = current;
    skills.entries = entries;
    const nextConfig: GodsEyeConfig = {
      ...cfg,
      skills,
    };
    await writeConfigFile(nextConfig);
    respond(true, { ok: true, skillKey: p.skillKey, config: current }, undefined);
  },
  "skills.store.list": async ({ params, respond }) => {
    if (!validateSkillsStoreListParams(params)) {
      respond(
        false,
        undefined,
        errorShape(
          ErrorCodes.INVALID_REQUEST,
          `invalid skills.store.list params: ${formatValidationErrors(validateSkillsStoreListParams.errors)}`,
        ),
      );
      return;
    }
    try {
      const p = (params ?? {}) as { query?: string; limit?: number };
      if (p.query?.trim()) {
        const results = await searchClawHubSkills({
          query: p.query.trim(),
          limit: p.limit ?? 50,
        });
        const items = results.map((r) => ({
          slug: r.slug,
          displayName: r.displayName,
          summary: r.summary ?? "",
          score: r.score,
          updatedAt: r.updatedAt,
        }));
        const translated = await translateStoreItems(items);
        respond(true, { items: translated }, undefined);
      } else {
        const result = await listClawHubPackages({ family: "skill", limit: p.limit ?? 50 });
        const items = result.items.map((item) => ({
          slug: item.name,
          displayName: item.displayName,
          summary: item.summary ?? "",
          owner: item.ownerHandle ?? undefined,
          updatedAt: item.updatedAt,
        }));
        const translated = await translateStoreItems(items);
        respond(true, { items: translated }, undefined);
      }
    } catch (err) {
      respond(false, undefined, errorShape(ErrorCodes.UNAVAILABLE, String(err)));
    }
  },
  "skills.store.detail": async ({ params, respond }) => {
    const slug = (params as { slug?: string })?.slug?.trim();
    if (!slug) {
      respond(false, undefined, errorShape(ErrorCodes.INVALID_REQUEST, "slug is required"));
      return;
    }
    try {
      const detail = await fetchClawHubSkillDetail({ slug });
      respond(
        true,
        {
          slug: detail.skill?.slug ?? slug,
          displayName: await translateToEnglish(detail.skill?.displayName ?? slug),
          summary: await translateToEnglish(detail.skill?.summary ?? ""),
          version: detail.latestVersion?.version ?? "",
          changelog: await translateToEnglish(detail.latestVersion?.changelog ?? ""),
          license: (detail.latestVersion as { license?: string })?.license ?? "",
          downloads: (detail.skill as { stats?: { downloads?: number } })?.stats?.downloads ?? 0,
          stars: (detail.skill as { stats?: { stars?: number } })?.stats?.stars ?? 0,
          installs:
            (detail.skill as { stats?: { installsCurrent?: number } })?.stats?.installsCurrent ?? 0,
          os: detail.metadata?.os ?? [],
          owner: {
            handle: detail.owner?.handle ?? "",
            displayName: detail.owner?.displayName ?? "",
            image: detail.owner?.image ?? "",
          },
          createdAt: detail.skill?.createdAt ?? 0,
          updatedAt: detail.skill?.updatedAt ?? 0,
        },
        undefined,
      );
    } catch (err) {
      respond(false, undefined, errorShape(ErrorCodes.UNAVAILABLE, String(err)));
    }
  },
};
