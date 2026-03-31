import type { GatewayBrowserClient } from "../gateway.ts";
import type { AgentsListResult, ModelCatalogEntry, SkillStatusReport } from "../types.ts";

export type AgentStoreEntry = {
  id: string;
  name: string;
  summary?: string;
  role?: string;
  model?: string;
  skills?: string[];
  avatar?: string;
  emoji?: string;
  createdAt?: number;
};

export type AgentStoreState = {
  client: GatewayBrowserClient | null;
  connected: boolean;
  agentStoreLoading: boolean;
  agentStoreError: string | null;
  agentStoreAgents: AgentStoreEntry[];
  agentStoreCreating: boolean;
  agentStoreCreateError: string | null;
  agentStoreShowCreate: boolean;
  agentStoreCreateName: string;
  agentStoreCreateSummary: string;
  agentStoreCreateRole: string;
  agentStoreCreateModel: string;
  agentStoreCreateSkills: string[];
  agentStoreCreateAvatar: string;
  agentStoreSearch: string;
  agentStoreSort: "newest" | "name" | "recent";
  // Data for dropdowns
  agentStoreModelCatalog: ModelCatalogEntry[];
  agentStoreSkillsReport: SkillStatusReport | null;
};

function getErrorMessage(err: unknown): string {
  if (err instanceof Error) {
    return err.message;
  }
  return String(err);
}

export async function loadAgentStoreAgents(state: AgentStoreState) {
  if (!state.client || !state.connected) {
    return;
  }
  if (state.agentStoreLoading) {
    return;
  }
  state.agentStoreLoading = true;
  state.agentStoreError = null;
  try {
    const res = await state.client.request<AgentsListResult>("agents.list", {});
    if (res) {
      state.agentStoreAgents = res.agents.map((agent) => ({
        id: agent.id,
        name: agent.identity?.name ?? agent.name ?? agent.id,
        avatar: agent.identity?.avatarUrl ?? agent.identity?.avatar ?? "",
        emoji: agent.identity?.emoji ?? "",
      }));
    }
  } catch (err) {
    state.agentStoreError = getErrorMessage(err);
  } finally {
    state.agentStoreLoading = false;
  }
}

export async function loadAgentStoreModels(state: AgentStoreState) {
  if (!state.client || !state.connected) {
    return;
  }
  try {
    const res = await state.client.request<{ models: ModelCatalogEntry[] }>("models.list", {});
    if (res?.models) {
      state.agentStoreModelCatalog = res.models;
    }
  } catch {
    // Non-critical; model list may be empty
  }
}

export async function loadAgentStoreSkills(state: AgentStoreState) {
  if (!state.client || !state.connected) {
    return;
  }
  try {
    const res = await state.client.request<SkillStatusReport>("skills.status", {});
    if (res) {
      state.agentStoreSkillsReport = res;
    }
  } catch {
    // Non-critical
  }
}

export async function createAgent(state: AgentStoreState) {
  if (!state.client || !state.connected) {
    return;
  }
  const name = state.agentStoreCreateName.trim();
  if (!name) {
    state.agentStoreCreateError = "Agent name is required";
    return;
  }
  state.agentStoreCreating = true;
  state.agentStoreCreateError = null;
  try {
    // Create the agent via gateway RPC
    const agentId = name.toLowerCase().replaceAll(/[^a-z0-9-]/g, "-");
    await state.client.request("agents.create", {
      name,
      workspace: agentId,
      emoji: state.agentStoreCreateAvatar || undefined,
      avatar: state.agentStoreCreateAvatar || undefined,
    });

    // Write the agent's SOUL.md / identity files with the role & summary
    if (state.agentStoreCreateRole.trim()) {
      try {
        await state.client.request("agents.files.set", {
          agentId,
          name: "SOUL.md",
          content: `# ${name}\n\n${state.agentStoreCreateSummary.trim() ? `> ${state.agentStoreCreateSummary.trim()}\n\n` : ""}## Role Definition & Strategy\n\n${state.agentStoreCreateRole.trim()}\n`,
        });
      } catch {
        // Non-critical
      }
    }

    // Write identity
    if (state.agentStoreCreateSummary.trim() || state.agentStoreCreateAvatar) {
      try {
        const identityLines = [`name: ${name}`];
        if (state.agentStoreCreateAvatar) {
          identityLines.push(`emoji: ${state.agentStoreCreateAvatar}`);
        }
        await state.client.request("agents.files.set", {
          agentId,
          name: "IDENTITY.md",
          content: `---\n${identityLines.join("\n")}\n---\n\n${state.agentStoreCreateSummary.trim()}\n`,
        });
      } catch {
        // Non-critical
      }
    }

    // Reload agents
    await loadAgentStoreAgents(state);

    // Reset form
    state.agentStoreShowCreate = false;
    state.agentStoreCreateName = "";
    state.agentStoreCreateSummary = "";
    state.agentStoreCreateRole = "";
    state.agentStoreCreateModel = "";
    state.agentStoreCreateSkills = [];
    state.agentStoreCreateAvatar = "";
  } catch (err) {
    state.agentStoreCreateError = getErrorMessage(err);
  } finally {
    state.agentStoreCreating = false;
  }
}

export async function deleteAgent(state: AgentStoreState, agentId: string) {
  if (!state.client || !state.connected) {
    return;
  }
  try {
    await state.client.request("agents.delete", { agentId, removeFiles: false });
    await loadAgentStoreAgents(state);
  } catch (err) {
    state.agentStoreError = getErrorMessage(err);
  }
}
