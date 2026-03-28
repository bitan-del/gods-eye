import { describe, expect, it } from "vitest";
import {
  aggregateStatus,
  CHANNEL_CONFIGS,
  checkPermissions,
  checkTokenFormat,
  checkTokenPresent,
  checkWebhookUrl,
  formatDiagnosticReport,
  runChannelDiagnostics,
} from "./channel-diagnostics.js";
import type { DiagnosticCheck } from "./channel-diagnostics.js";

describe("channel-diagnostics", () => {
  // ── Token presence ──────────────────────────────────────────────

  describe("checkTokenPresent", () => {
    it("passes when the env var is set and non-empty", () => {
      const result = checkTokenPresent("telegram", "TELEGRAM_BOT_TOKEN", {
        TELEGRAM_BOT_TOKEN: "123:abc",
      });
      expect(result.passed).toBe(true);
      expect(result.name).toBe("telegram:token-present");
    });

    it("fails when the env var is missing", () => {
      const result = checkTokenPresent("telegram", "TELEGRAM_BOT_TOKEN", {});
      expect(result.passed).toBe(false);
      expect(result.fixHint).toContain("TELEGRAM_BOT_TOKEN");
    });

    it("fails when the env var is empty string", () => {
      const result = checkTokenPresent("discord", "DISCORD_BOT_TOKEN", {
        DISCORD_BOT_TOKEN: "",
      });
      expect(result.passed).toBe(false);
    });

    it("fails when the env var is undefined", () => {
      const result = checkTokenPresent("slack", "SLACK_BOT_TOKEN", {
        SLACK_BOT_TOKEN: undefined,
      });
      expect(result.passed).toBe(false);
    });
  });

  // ── Token format ────────────────────────────────────────────────

  describe("checkTokenFormat", () => {
    it("passes when token matches the expected pattern", () => {
      const result = checkTokenFormat(
        "telegram",
        "123456:ABCDefghIjklMnopqRstUvwxyz0123456789",
        /^\d+:[A-Za-z0-9_-]{35,}$/,
      );
      expect(result.passed).toBe(true);
      expect(result.name).toBe("telegram:token-format");
    });

    it("fails when token does not match the expected pattern", () => {
      const result = checkTokenFormat("telegram", "bad-token", /^\d+:[A-Za-z0-9_-]{35,}$/);
      expect(result.passed).toBe(false);
      expect(result.fixHint).toContain("telegram");
    });

    it("passes for non-empty token when no pattern is provided", () => {
      const result = checkTokenFormat("whatsapp", "some-token");
      expect(result.passed).toBe(true);
      expect(result.message).toContain("no format pattern");
    });

    it("fails for empty token when no pattern is provided", () => {
      const result = checkTokenFormat("whatsapp", "");
      expect(result.passed).toBe(false);
    });

    it("validates slack token pattern correctly", () => {
      const result = checkTokenFormat("slack", "xoxb-123456-abcDEF", /^xoxb-[0-9]+-[0-9A-Za-z-]+$/);
      expect(result.passed).toBe(true);
    });
  });

  // ── Webhook URL ─────────────────────────────────────────────────

  describe("checkWebhookUrl", () => {
    it("passes for a valid HTTPS URL", () => {
      const result = checkWebhookUrl("https://example.com/webhook");
      expect(result.passed).toBe(true);
      expect(result.name).toBe("webhook-url");
    });

    it("fails for an HTTP URL", () => {
      const result = checkWebhookUrl("http://example.com/webhook");
      expect(result.passed).toBe(false);
      expect(result.message).toContain("http:");
      expect(result.autoFixable).toBe(true);
    });

    it("fails for an empty string", () => {
      const result = checkWebhookUrl("");
      expect(result.passed).toBe(false);
      expect(result.message).toContain("empty");
    });

    it("fails for a malformed URL", () => {
      const result = checkWebhookUrl("not a url at all");
      expect(result.passed).toBe(false);
      expect(result.message).toContain("not a valid URL");
    });

    it("returns the origin in the success message", () => {
      const result = checkWebhookUrl("https://hooks.slack.com/services/T00/B00/xxx");
      expect(result.passed).toBe(true);
      expect(result.message).toContain("https://hooks.slack.com");
    });
  });

  // ── Permissions ─────────────────────────────────────────────────

  describe("checkPermissions", () => {
    it("passes when all required permissions are granted", () => {
      const result = checkPermissions(
        "discord",
        ["SEND_MESSAGES", "VIEW_CHANNEL"],
        ["SEND_MESSAGES", "VIEW_CHANNEL", "EMBED_LINKS"],
      );
      expect(result.passed).toBe(true);
    });

    it("fails when some permissions are missing", () => {
      const result = checkPermissions(
        "discord",
        ["SEND_MESSAGES", "VIEW_CHANNEL", "EMBED_LINKS"],
        ["SEND_MESSAGES"],
      );
      expect(result.passed).toBe(false);
      expect(result.message).toContain("EMBED_LINKS");
      expect(result.message).toContain("VIEW_CHANNEL");
    });

    it("sorts missing permissions alphabetically in the message", () => {
      const result = checkPermissions("slack", ["chat:write", "channels:read", "users:read"], []);
      // The missing list should be sorted
      expect(result.message).toBe("Missing permissions: channels:read, chat:write, users:read");
    });

    it("passes for empty required permissions", () => {
      const result = checkPermissions("signal", [], []);
      expect(result.passed).toBe(true);
    });
  });

  // ── Status aggregation ──────────────────────────────────────────

  describe("aggregateStatus", () => {
    it("returns healthy when all checks pass", () => {
      const checks: DiagnosticCheck[] = [
        { name: "a", passed: true, message: "ok", autoFixable: false },
        { name: "b", passed: true, message: "ok", autoFixable: false },
      ];
      expect(aggregateStatus(checks)).toBe("healthy");
    });

    it("returns down when all checks fail", () => {
      const checks: DiagnosticCheck[] = [
        { name: "a", passed: false, message: "fail", autoFixable: false },
        { name: "b", passed: false, message: "fail", autoFixable: false },
      ];
      expect(aggregateStatus(checks)).toBe("down");
    });

    it("returns degraded when some checks pass and some fail", () => {
      const checks: DiagnosticCheck[] = [
        { name: "a", passed: true, message: "ok", autoFixable: false },
        { name: "b", passed: false, message: "fail", autoFixable: false },
      ];
      expect(aggregateStatus(checks)).toBe("degraded");
    });

    it("returns healthy for empty checks array", () => {
      expect(aggregateStatus([])).toBe("healthy");
    });

    it("returns down for a single failing check", () => {
      const checks: DiagnosticCheck[] = [
        { name: "a", passed: false, message: "fail", autoFixable: false },
      ];
      expect(aggregateStatus(checks)).toBe("down");
    });

    it("returns healthy for a single passing check", () => {
      const checks: DiagnosticCheck[] = [
        { name: "a", passed: true, message: "ok", autoFixable: false },
      ];
      expect(aggregateStatus(checks)).toBe("healthy");
    });
  });

  // ── CHANNEL_CONFIGS ─────────────────────────────────────────────

  describe("CHANNEL_CONFIGS", () => {
    it("contains all five expected channels", () => {
      const channels = Object.keys(CHANNEL_CONFIGS).toSorted();
      expect(channels).toEqual(["discord", "signal", "slack", "telegram", "whatsapp"]);
    });

    it("each config has a tokenEnvVar and requiredPermissions array", () => {
      for (const [channel, config] of Object.entries(CHANNEL_CONFIGS)) {
        expect(config.tokenEnvVar, `${channel} missing tokenEnvVar`).toBeTruthy();
        expect(
          Array.isArray(config.requiredPermissions),
          `${channel} missing requiredPermissions`,
        ).toBe(true);
      }
    });
  });

  // ── Full diagnostic run ─────────────────────────────────────────

  describe("runChannelDiagnostics", () => {
    it("returns healthy for telegram with a valid token", () => {
      const env = { TELEGRAM_BOT_TOKEN: "123456789:ABCDefghIjklMnopqRstUvwxyz0123456789a" };
      const result = runChannelDiagnostics("telegram", env);
      expect(result.channel).toBe("telegram");
      expect(result.status).toBe("healthy");
      expect(result.checks.length).toBeGreaterThanOrEqual(2);
      expect(result.timestamp).toBeGreaterThan(0);
    });

    it("returns down for telegram with no token", () => {
      const result = runChannelDiagnostics("telegram", {});
      expect(result.status).toBe("down");
      // Should only have the token-present check (format skipped when token missing)
      expect(result.checks).toHaveLength(1);
    });

    it("returns degraded for discord with a present but malformed token", () => {
      const env = { DISCORD_BOT_TOKEN: "not-a-valid-discord-token" };
      const result = runChannelDiagnostics("discord", env);
      expect(result.status).toBe("degraded");
      expect(result.checks.length).toBe(2);
      // First check (present) passes, second (format) fails
      expect(result.checks[0].passed).toBe(true);
      expect(result.checks[1].passed).toBe(false);
    });

    it("returns healthy for slack with a valid token", () => {
      const env = { SLACK_BOT_TOKEN: "xoxb-123456789-abcDEF" };
      const result = runChannelDiagnostics("slack", env);
      expect(result.status).toBe("healthy");
    });

    it("handles unknown channels gracefully", () => {
      const result = runChannelDiagnostics("unknown-channel", {});
      expect(result.status).toBe("down");
      expect(result.checks).toHaveLength(1);
      expect(result.checks[0].message).toContain("No known configuration");
    });

    it("includes a timestamp", () => {
      const before = Date.now();
      const result = runChannelDiagnostics("signal", { SIGNAL_CLI_CONFIG: "/path/to/config" });
      const after = Date.now();
      expect(result.timestamp).toBeGreaterThanOrEqual(before);
      expect(result.timestamp).toBeLessThanOrEqual(after);
    });
  });

  // ── Report formatting ───────────────────────────────────────────

  describe("formatDiagnosticReport", () => {
    it("includes the channel name and status", () => {
      const report = formatDiagnosticReport({
        channel: "telegram",
        status: "healthy",
        checks: [
          {
            name: "telegram:token-present",
            passed: true,
            message: "Token is set",
            autoFixable: false,
          },
        ],
        timestamp: Date.now(),
      });
      expect(report).toContain("Channel: telegram");
      expect(report).toContain("[HEALTHY]");
    });

    it("uses check mark for passing checks", () => {
      const report = formatDiagnosticReport({
        channel: "slack",
        status: "healthy",
        checks: [{ name: "slack:token-present", passed: true, message: "ok", autoFixable: false }],
        timestamp: Date.now(),
      });
      expect(report).toContain("\u2713");
    });

    it("uses cross mark for failing checks and includes hint", () => {
      const report = formatDiagnosticReport({
        channel: "discord",
        status: "down",
        checks: [
          {
            name: "discord:token-present",
            passed: false,
            message: "Token missing",
            fixHint: "Set the DISCORD_BOT_TOKEN",
            autoFixable: false,
          },
        ],
        timestamp: Date.now(),
      });
      expect(report).toContain("\u2717");
      expect(report).toContain("Hint: Set the DISCORD_BOT_TOKEN");
    });

    it("handles empty checks array", () => {
      const report = formatDiagnosticReport({
        channel: "whatsapp",
        status: "healthy",
        checks: [],
        timestamp: Date.now(),
      });
      expect(report).toContain("No checks were executed");
    });

    it("formats degraded status correctly", () => {
      const report = formatDiagnosticReport({
        channel: "signal",
        status: "degraded",
        checks: [
          { name: "a", passed: true, message: "ok", autoFixable: false },
          { name: "b", passed: false, message: "fail", fixHint: "fix it", autoFixable: false },
        ],
        timestamp: Date.now(),
      });
      expect(report).toContain("[DEGRADED]");
      expect(report).toContain("\u2713 a:");
      expect(report).toContain("\u2717 b:");
      expect(report).toContain("Hint: fix it");
    });
  });
});
