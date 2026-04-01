import type { GatewayBrowserClient } from "../gateway.ts";

export type SecurityFeatureDef = {
  id: string;
  title: string;
  description: string;
  icon: string;
  iconBg: string;
  badge: string;
  badgeColor: string;
  /** Config path to read/write for toggle, or null if always-on */
  configPath: string[] | null;
  /** How to interpret the config value */
  configType: "boolean" | "enum-off" | "enum-deny" | "always-on";
  /** For enum types, what value means "enabled" */
  enabledValue?: string;
  /** For enum types, what value means "disabled" */
  disabledValue?: string;
  /** Default enabled state when no config exists */
  defaultEnabled: boolean;
};

export type SecurityState = {
  client: GatewayBrowserClient | null;
  connected: boolean;
  securityFeatures: Record<string, boolean>;
  securityLoading: boolean;
  securitySaving: string | null;
  securityError: string | null;
  configSnapshot?: {
    config?: Record<string, unknown> | null;
    hash?: string | null;
    raw?: string | null;
  } | null;
};

export const SECURITY_FEATURE_DEFS: SecurityFeatureDef[] = [
  {
    id: "agent-firewall",
    title: "Agent Firewall",
    description:
      "Multi-layer defense that scans agent inputs for prompt injection, monitors tool calls for privilege escalation and data exfiltration, and checks outputs for sensitive data leaks like API keys and tokens.",
    icon: "🛡️",
    iconBg: "#fee2e2",
    badge: "3-Layer Defense",
    badgeColor: "#ef4444",
    configPath: null,
    configType: "always-on",
    defaultEnabled: true,
  },
  {
    id: "exec-approval",
    title: "Execution Approval",
    description:
      "When agents invoke tools, the system enforces approval gates with configurable security levels — deny, allowlist, or full access. Commands not in the allowlist require explicit user approval before running.",
    icon: "✅",
    iconBg: "#fef3c7",
    badge: "Active Defense",
    badgeColor: "#f59e0b",
    configPath: ["tools", "exec", "security"],
    configType: "enum-deny",
    enabledValue: "allowlist",
    disabledValue: "full",
    defaultEnabled: true,
  },
  {
    id: "data-protection",
    title: "User Data Protection",
    description:
      "Scans prompts and agent outputs to detect personal privacy data, sensitive keys, account credentials, and other high-risk information. Automatically redacts sensitive values in logs and audit trails.",
    icon: "🔒",
    iconBg: "#d1fae5",
    badge: "Smart Detection",
    badgeColor: "#10b981",
    configPath: ["logging", "redactSensitive"],
    configType: "enum-off",
    enabledValue: "tools",
    disabledValue: "off",
    defaultEnabled: true,
  },
  {
    id: "skill-scanner",
    title: "Skill Security Scan",
    description:
      "Before any skill is installed or integrated, the system performs multi-layer security checks including source credibility, code review for dangerous patterns, and permission assessment.",
    icon: "🔄",
    iconBg: "#dbeafe",
    badge: "Multi-layer Check",
    badgeColor: "#3b82f6",
    configPath: null,
    configType: "always-on",
    defaultEnabled: true,
  },
  {
    id: "supply-chain",
    title: "Supply Chain Integrity",
    description:
      "Verifies tool and plugin integrity using SHA-256 hashing. Detects prompt injection in tool descriptions, unicode tricks, hidden content, and suspicious external URLs in configurations.",
    icon: "🔗",
    iconBg: "#ede9fe",
    badge: "Hash Verified",
    badgeColor: "#8b5cf6",
    configPath: null,
    configType: "always-on",
    defaultEnabled: true,
  },
  {
    id: "sandbox",
    title: "Sandbox Isolation",
    description:
      "Runs agent tool execution in isolated Docker containers with read-only filesystems, network isolation, dropped Linux capabilities, memory and CPU limits, and seccomp profiles.",
    icon: "📦",
    iconBg: "#fce7f3",
    badge: "Container Isolated",
    badgeColor: "#ec4899",
    configPath: ["tools", "exec", "host"],
    configType: "enum-off",
    enabledValue: "sandbox",
    disabledValue: "gateway",
    defaultEnabled: true,
  },
  {
    id: "exec-ask",
    title: "Execution Ask Mode",
    description:
      "Controls whether the system asks for user approval before running commands. In 'on-miss' mode, only unknown commands need approval. In 'always' mode, every command requires confirmation.",
    icon: "👤",
    iconBg: "#f0fdf4",
    badge: "User Confirmation",
    badgeColor: "#16a34a",
    configPath: ["tools", "exec", "ask"],
    configType: "enum-off",
    enabledValue: "on-miss",
    disabledValue: "off",
    defaultEnabled: true,
  },
  {
    id: "rate-limiting",
    title: "Rate Limiting & Auth",
    description:
      "Sliding-window rate limiter for failed authentication attempts with automatic IP lockout. Supports gateway token, password, Tailscale identity, and device token authentication methods.",
    icon: "⏱️",
    iconBg: "#fff7ed",
    badge: "Auto Lockout",
    badgeColor: "#ea580c",
    configPath: null,
    configType: "always-on",
    defaultEnabled: true,
  },
  {
    id: "ssrf-protection",
    title: "SSRF & Network Guard",
    description:
      "Prevents server-side request forgery by blocking access to private networks, metadata endpoints, and internal services. Validates DNS resolution and supports hostname allowlists with wildcards.",
    icon: "🌐",
    iconBg: "#ecfeff",
    badge: "Network Filtered",
    badgeColor: "#0891b2",
    configPath: null,
    configType: "always-on",
    defaultEnabled: true,
  },
  {
    id: "audit-logging",
    title: "Permission Audit Log",
    description:
      "5-layer audit tracking covering identity, input, reasoning, execution, and outcome. Tracks all tool calls, file access, shell commands, API requests, and config changes with sensitive value redaction.",
    icon: "📋",
    iconBg: "#f5f3ff",
    badge: "5-Layer Audit",
    badgeColor: "#7c3aed",
    configPath: null,
    configType: "always-on",
    defaultEnabled: true,
  },
  {
    id: "external-content",
    title: "External Content Security",
    description:
      "Detects and neutralizes suspicious patterns in external content such as emails and webhooks. Adds tamper-proof boundary markers and prevents external content from being treated as system instructions.",
    icon: "📧",
    iconBg: "#fef9c3",
    badge: "Injection Guard",
    badgeColor: "#ca8a04",
    configPath: null,
    configType: "always-on",
    defaultEnabled: true,
  },
  {
    id: "device-auth",
    title: "Device Authentication",
    description:
      "Requires device-level authentication for Control UI access. When enabled, each browser must be paired and approved before accessing the gateway dashboard. Prevents unauthorized remote access.",
    icon: "⚠️",
    iconBg: "#fef2f2",
    badge: "Device Verified",
    badgeColor: "#dc2626",
    configPath: ["gateway", "controlUi", "dangerouslyDisableDeviceAuth"],
    configType: "boolean",
    defaultEnabled: true,
  },
];

/** Read a nested value from an object */
function getNestedValue(obj: Record<string, unknown>, path: string[]): unknown {
  let current: unknown = obj;
  for (const key of path) {
    if (current == null || typeof current !== "object") {
      return undefined;
    }
    current = (current as Record<string, unknown>)[key];
  }
  return current;
}

/** Set a nested value in an object (mutates) */
function setNestedValue(obj: Record<string, unknown>, path: string[], value: unknown): void {
  let current = obj;
  for (let i = 0; i < path.length - 1; i++) {
    if (current[path[i]] == null || typeof current[path[i]] !== "object") {
      current[path[i]] = {};
    }
    current = current[path[i]] as Record<string, unknown>;
  }
  current[path[path.length - 1]] = value;
}

/** Determine if a feature is enabled based on its config value */
function isFeatureEnabled(def: SecurityFeatureDef, configValue: unknown): boolean {
  if (def.configType === "always-on") {
    return true;
  }
  if (configValue === undefined || configValue === null) {
    return def.defaultEnabled;
  }
  switch (def.configType) {
    case "boolean":
      // dangerouslyDisableDeviceAuth: true means DISABLED
      if (def.id === "device-auth") {
        return configValue !== true;
      }
      return configValue === true;
    case "enum-off":
      return configValue !== def.disabledValue && configValue !== "off";
    case "enum-deny":
      return configValue !== def.disabledValue;
    default:
      return def.defaultEnabled;
  }
}

/** Load security feature states from config */
export async function loadSecurityState(state: SecurityState) {
  if (!state.client || !state.connected) {
    return;
  }
  state.securityLoading = true;
  state.securityError = null;
  try {
    const res = await state.client.request<{
      config: Record<string, unknown>;
      hash: string;
      raw: string | null;
    } | null>("config.get", {});
    if (!res) {
      state.securityError = "No config available.";
      return;
    }
    const config = res.config ?? {};
    const features: Record<string, boolean> = {};
    for (const def of SECURITY_FEATURE_DEFS) {
      if (def.configPath) {
        const val = getNestedValue(config, def.configPath);
        features[def.id] = isFeatureEnabled(def, val);
      } else {
        features[def.id] = def.defaultEnabled;
      }
    }
    state.securityFeatures = features;
  } catch (err) {
    state.securityError = String(err);
  } finally {
    state.securityLoading = false;
  }
}

/** Toggle a security feature and persist to config */
export async function toggleSecurityFeature(
  state: SecurityState,
  featureId: string,
  enabled: boolean,
) {
  const def = SECURITY_FEATURE_DEFS.find((f) => f.id === featureId);
  if (!def || !def.configPath || def.configType === "always-on") {
    return;
  }
  if (!state.client || !state.connected) {
    return;
  }
  state.securitySaving = featureId;
  state.securityError = null;

  // Determine value to write
  let value: unknown;
  switch (def.configType) {
    case "boolean":
      value = def.id === "device-auth" ? !enabled : enabled;
      break;
    case "enum-off":
    case "enum-deny":
      value = enabled ? def.enabledValue : def.disabledValue;
      break;
  }

  try {
    // Load current config
    const res = await state.client.request<{
      config: Record<string, unknown>;
      hash: string;
      raw: string | null;
    } | null>("config.get", {});
    if (!res?.raw) {
      state.securityError = "Cannot read config for update.";
      state.securitySaving = null;
      return;
    }

    // Parse, patch, and save
    const config: Record<string, unknown> = JSON.parse(res.raw);
    setNestedValue(config, def.configPath, value);

    await state.client.request("config.set", {
      raw: JSON.stringify(config, null, 2),
      baseHash: res.hash,
    });

    // Optimistic local update
    state.securityFeatures = { ...state.securityFeatures, [featureId]: enabled };
  } catch (err) {
    state.securityError = `Failed to update ${def.title}: ${String(err)}`;
    // Reload actual state
    await loadSecurityState(state);
  } finally {
    state.securitySaving = null;
  }
}
