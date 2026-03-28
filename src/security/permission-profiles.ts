// Pre-built permission profiles for the setup wizard.
// Each profile enforces principle-of-least-privilege defaults for tool access,
// filesystem paths, and sandbox/network/shell capabilities.

export type ProfileName = "minimal" | "standard" | "power" | "unrestricted";

export interface PermissionProfile {
  name: ProfileName;
  description: string;
  toolPolicy: {
    allow: string[];
    deny: string[];
    requireApproval: string[];
  };
  pathPolicy: {
    allowedPaths: string[];
    blockedPaths: string[];
  };
  sandboxEnabled: boolean;
  maxConcurrentAgents: number;
  canModifyConfig: boolean;
  canAccessNetwork: boolean;
  canExecuteShell: boolean;
}

// --- Profile definitions ---

const COMMON_BLOCKED_PATHS = ["~/.ssh", "~/.aws", "~/.gnupg"];

const PROFILES: Record<ProfileName, PermissionProfile> = {
  minimal: {
    name: "minimal",
    description: "Read-only access. No shell, file writes, or network.",
    toolPolicy: {
      allow: ["file_read", "list_files", "search", "get_*", "status"],
      deny: [
        "*_write",
        "*_edit",
        "*_delete",
        "bash",
        "shell",
        "exec",
        "config_*",
        "cron_*",
        "gateway_*",
      ],
      requireApproval: [],
    },
    pathPolicy: {
      allowedPaths: ["**"],
      blockedPaths: [...COMMON_BLOCKED_PATHS, "~/.config", "/etc", "/var"],
    },
    sandboxEnabled: true,
    maxConcurrentAgents: 1,
    canModifyConfig: false,
    canAccessNetwork: false,
    canExecuteShell: false,
  },
  standard: {
    name: "standard",
    description: "Workspace read/write with sandboxed shell. No config changes.",
    toolPolicy: {
      allow: [
        "file_read",
        "file_write",
        "file_edit",
        "list_files",
        "search",
        "git_*",
        "web_search",
      ],
      deny: ["config_*", "cron_*", "gateway_*", "sudo", "chmod", "chown"],
      requireApproval: ["bash", "shell", "exec"],
    },
    pathPolicy: {
      allowedPaths: ["~/.godseye/workspace/**", "~/projects/**"],
      blockedPaths: [...COMMON_BLOCKED_PATHS],
    },
    sandboxEnabled: true,
    maxConcurrentAgents: 2,
    canModifyConfig: false,
    canAccessNetwork: true,
    canExecuteShell: true,
  },
  power: {
    name: "power",
    description: "Full tool access with approval gates for dangerous operations.",
    toolPolicy: {
      allow: ["*"],
      deny: ["sudo", "rm -rf /"],
      requireApproval: ["config_*", "gateway_*", "cron_*", "delete_*"],
    },
    pathPolicy: {
      allowedPaths: ["**"],
      blockedPaths: [],
    },
    sandboxEnabled: false,
    maxConcurrentAgents: 4,
    canModifyConfig: true,
    canAccessNetwork: true,
    canExecuteShell: true,
  },
  unrestricted: {
    name: "unrestricted",
    description: "Everything allowed. Use only in trusted, isolated environments.",
    toolPolicy: {
      allow: ["*"],
      deny: [],
      requireApproval: [],
    },
    pathPolicy: {
      allowedPaths: ["**"],
      blockedPaths: [],
    },
    sandboxEnabled: false,
    maxConcurrentAgents: 8,
    canModifyConfig: true,
    canAccessNetwork: true,
    canExecuteShell: true,
  },
};

/** Get a permission profile by name. */
export function getProfile(name: ProfileName): PermissionProfile {
  return PROFILES[name];
}

/** List all available profiles with descriptions. */
export function listProfiles(): Array<{ name: ProfileName; description: string; summary: string }> {
  return [
    {
      name: "minimal",
      description: PROFILES.minimal.description,
      summary: "Read-only, no shell/network",
    },
    {
      name: "standard",
      description: PROFILES.standard.description,
      summary: "Workspace read/write, sandboxed shell",
    },
    {
      name: "power",
      description: PROFILES.power.description,
      summary: "Full access, approval for dangerous ops",
    },
    {
      name: "unrestricted",
      description: PROFILES.unrestricted.description,
      summary: "No restrictions (discouraged)",
    },
  ];
}

// Glob-style pattern matching: supports * as wildcard prefix/suffix.
function matchesPattern(pattern: string, value: string): boolean {
  if (pattern === "*") {
    return true;
  }
  if (pattern.startsWith("*") && pattern.endsWith("*")) {
    return value.includes(pattern.slice(1, -1));
  }
  if (pattern.endsWith("*")) {
    return value.startsWith(pattern.slice(0, -1));
  }
  if (pattern.startsWith("*")) {
    return value.endsWith(pattern.slice(1));
  }
  return pattern === value;
}

function matchesAny(patterns: string[], value: string): boolean {
  return patterns.some((p) => matchesPattern(p, value));
}

/** Validate that a tool call is allowed under a profile. */
export function checkToolPermission(
  profile: PermissionProfile,
  toolName: string,
): { allowed: boolean; requiresApproval: boolean; reason: string } {
  const name = toolName.toLowerCase();

  // Explicit deny takes priority.
  if (matchesAny(profile.toolPolicy.deny, name)) {
    return {
      allowed: false,
      requiresApproval: false,
      reason: `Tool "${toolName}" is denied by ${profile.name} profile`,
    };
  }

  // Check approval requirement.
  const needsApproval = matchesAny(profile.toolPolicy.requireApproval, name);

  // Check allow list.
  if (matchesAny(profile.toolPolicy.allow, name)) {
    return {
      allowed: true,
      requiresApproval: needsApproval,
      reason: needsApproval
        ? `Tool "${toolName}" requires approval under ${profile.name} profile`
        : `Tool "${toolName}" is allowed by ${profile.name} profile`,
    };
  }

  // Not explicitly allowed -- default deny for non-wildcard profiles.
  return {
    allowed: false,
    requiresApproval: false,
    reason: `Tool "${toolName}" is not in the allow list for ${profile.name} profile`,
  };
}

/** Validate that a file path is accessible under a profile. */
export function checkPathPermission(
  profile: PermissionProfile,
  filePath: string,
): { allowed: boolean; reason: string } {
  // Check blocked paths first (always takes priority).
  for (const blocked of profile.pathPolicy.blockedPaths) {
    if (filePath.startsWith(blocked) || filePath === blocked) {
      return { allowed: false, reason: `Path "${filePath}" is blocked by ${profile.name} profile` };
    }
  }

  // Check allowed paths.
  for (const allowed of profile.pathPolicy.allowedPaths) {
    const base = allowed.replace(/\/?\*\*$/, "");
    if (base === "" || filePath.startsWith(base) || filePath === base) {
      return { allowed: true, reason: `Path "${filePath}" is allowed by ${profile.name} profile` };
    }
  }

  return {
    allowed: false,
    reason: `Path "${filePath}" is not within allowed paths for ${profile.name} profile`,
  };
}

/** Get a human-readable description of what a profile allows. */
export function describeProfile(name: ProfileName): string {
  const p = PROFILES[name];
  const lines = [
    `Profile: ${p.name}`,
    `  ${p.description}`,
    `  Sandbox: ${p.sandboxEnabled ? "enabled" : "disabled"}`,
    `  Shell: ${p.canExecuteShell ? "yes" : "no"}`,
    `  Network: ${p.canAccessNetwork ? "yes" : "no"}`,
    `  Config changes: ${p.canModifyConfig ? "yes" : "no"}`,
    `  Max concurrent agents: ${p.maxConcurrentAgents}`,
    `  Allowed tools: ${p.toolPolicy.allow.join(", ")}`,
    `  Denied tools: ${p.toolPolicy.deny.length > 0 ? p.toolPolicy.deny.join(", ") : "none"}`,
    `  Approval required: ${p.toolPolicy.requireApproval.length > 0 ? p.toolPolicy.requireApproval.join(", ") : "none"}`,
  ];
  return lines.join("\n");
}

/** Compare two profiles side-by-side. */
export function compareProfiles(
  a: ProfileName,
  b: ProfileName,
): Array<{ aspect: string; profileA: string; profileB: string }> {
  const pa = PROFILES[a];
  const pb = PROFILES[b];
  return [
    { aspect: "Sandbox", profileA: String(pa.sandboxEnabled), profileB: String(pb.sandboxEnabled) },
    {
      aspect: "Shell access",
      profileA: String(pa.canExecuteShell),
      profileB: String(pb.canExecuteShell),
    },
    {
      aspect: "Network access",
      profileA: String(pa.canAccessNetwork),
      profileB: String(pb.canAccessNetwork),
    },
    {
      aspect: "Config changes",
      profileA: String(pa.canModifyConfig),
      profileB: String(pb.canModifyConfig),
    },
    {
      aspect: "Max concurrent agents",
      profileA: String(pa.maxConcurrentAgents),
      profileB: String(pb.maxConcurrentAgents),
    },
    {
      aspect: "Allowed tools",
      profileA: pa.toolPolicy.allow.join(", "),
      profileB: pb.toolPolicy.allow.join(", "),
    },
    {
      aspect: "Denied tools",
      profileA: pa.toolPolicy.deny.join(", ") || "none",
      profileB: pb.toolPolicy.deny.join(", ") || "none",
    },
    {
      aspect: "Requires approval",
      profileA: pa.toolPolicy.requireApproval.join(", ") || "none",
      profileB: pb.toolPolicy.requireApproval.join(", ") || "none",
    },
    {
      aspect: "Blocked paths",
      profileA: pa.pathPolicy.blockedPaths.join(", ") || "none",
      profileB: pb.pathPolicy.blockedPaths.join(", ") || "none",
    },
  ];
}
