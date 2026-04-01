import { html } from "lit";

export type SecurityFeature = {
  id: string;
  title: string;
  description: string;
  icon: string;
  iconBg: string;
  badge: string;
  badgeColor: string;
  enabled: boolean;
};

export type SecurityProps = {
  features: SecurityFeature[];
  onToggle: (featureId: string, enabled: boolean) => void;
};

const SECURITY_FEATURES: SecurityFeature[] = [
  {
    id: "agent-firewall",
    title: "Agent Firewall",
    description:
      "Multi-layer defense that scans agent inputs for prompt injection, monitors tool calls for privilege escalation and data exfiltration, and checks outputs for sensitive data leaks like API keys and tokens.",
    icon: "🛡️",
    iconBg: "#fee2e2",
    badge: "3-Layer Defense",
    badgeColor: "#ef4444",
    enabled: true,
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
    enabled: true,
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
    enabled: true,
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
    enabled: true,
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
    enabled: true,
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
    enabled: true,
  },
  {
    id: "permission-profiles",
    title: "Permission Profiles",
    description:
      "Enforces principle of least privilege with pre-built profiles: minimal (read-only), standard (workspace access), power (approval-gated), and unrestricted. Controls tool access, shell, network, and paths.",
    icon: "👤",
    iconBg: "#f0fdf4",
    badge: "Least Privilege",
    badgeColor: "#16a34a",
    enabled: true,
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
    enabled: true,
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
    enabled: true,
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
    enabled: true,
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
    enabled: true,
  },
  {
    id: "dangerous-config",
    title: "Dangerous Config Detection",
    description:
      "Monitors configuration for risky flags like insecure auth, disabled device authentication, unsafe external content, and overly permissive host header settings. Warns before dangerous changes apply.",
    icon: "⚠️",
    iconBg: "#fef2f2",
    badge: "Config Monitor",
    badgeColor: "#dc2626",
    enabled: true,
  },
];

function renderFeatureCard(feature: SecurityFeature, props: SecurityProps): unknown {
  return html`
    <div class="sec-card">
      <div class="sec-card-left">
        <div class="sec-card-icon" style="background:${feature.iconBg}">
          ${feature.icon}
        </div>
      </div>
      <div class="sec-card-center">
        <div class="sec-card-title-row">
          <h3 class="sec-card-title">${feature.title}</h3>
          <span
            class="sec-card-badge"
            style="background:${feature.badgeColor}15;color:${feature.badgeColor};border:1px solid ${feature.badgeColor}30"
          >
            ✓ ${feature.badge}
          </span>
        </div>
        <p class="sec-card-desc">${feature.description}</p>
      </div>
      <div class="sec-card-right">
        <label class="sec-toggle">
          <input
            type="checkbox"
            ?checked=${feature.enabled}
            @change=${(e: Event) =>
              props.onToggle(feature.id, (e.target as HTMLInputElement).checked)}
          />
          <span class="sec-toggle-slider"></span>
        </label>
        <span class="sec-status ${feature.enabled ? "sec-status-active" : "sec-status-inactive"}">
          ${feature.enabled ? "Active" : "Inactive"}
        </span>
      </div>
    </div>
  `;
}

export function renderSecurity(props: SecurityProps): unknown {
  const features = props.features.length > 0 ? props.features : SECURITY_FEATURES;
  const activeCount = features.filter((f) => f.enabled).length;
  const totalCount = features.length;

  return html`
    <div class="sec-page">
      <div class="sec-page-header">
        <div class="sec-page-title-row">
          <h1 class="sec-page-title">Security</h1>
          <div class="sec-score">
            <span class="sec-score-num">${activeCount}/${totalCount}</span>
            <span class="sec-score-label">protections active</span>
          </div>
        </div>
        <p class="sec-page-subtitle">
          Defense-in-depth security layers protecting your agents, data, and environment.
        </p>
      </div>

      ${
        activeCount === totalCount
          ? html`
              <div class="sec-status-banner sec-status-banner-good">
                <span class="sec-status-banner-icon">🛡️</span>
                All security protections are active. Your system is fully protected.
              </div>
            `
          : html`
            <div class="sec-status-banner sec-status-banner-warn">
              <span class="sec-status-banner-icon">⚠️</span>
              ${totalCount - activeCount} protection${totalCount - activeCount > 1 ? "s" : ""} disabled. Review settings below.
            </div>
          `
      }

      <div class="sec-grid">
        ${features.map((f) => renderFeatureCard(f, props))}
      </div>

      <div class="sec-footer">
        <span class="sec-footer-icon">🛡️</span>
        Every operation you perform is under strict system protection
      </div>
    </div>
  `;
}

export { SECURITY_FEATURES };
