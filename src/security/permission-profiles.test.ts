import { describe, expect, it } from "vitest";
import {
  checkPathPermission,
  checkToolPermission,
  compareProfiles,
  describeProfile,
  getProfile,
  listProfiles,
} from "./permission-profiles.js";
import type { ProfileName } from "./permission-profiles.js";

describe("permission-profiles", () => {
  describe("getProfile", () => {
    it.each(["minimal", "standard", "power", "unrestricted"] as ProfileName[])(
      "returns the %s profile",
      (name) => {
        const profile = getProfile(name);
        expect(profile.name).toBe(name);
        expect(profile.description).toBeTruthy();
      },
    );
  });

  describe("listProfiles", () => {
    it("returns all 4 profiles", () => {
      const list = listProfiles();
      expect(list).toHaveLength(4);
      const names = list.map((p) => p.name);
      expect(names).toEqual(["minimal", "standard", "power", "unrestricted"]);
    });

    it("includes summary for each profile", () => {
      for (const p of listProfiles()) {
        expect(p.summary).toBeTruthy();
        expect(p.description).toBeTruthy();
      }
    });
  });

  describe("checkToolPermission", () => {
    it("minimal blocks shell tools", () => {
      const profile = getProfile("minimal");
      expect(checkToolPermission(profile, "bash").allowed).toBe(false);
      expect(checkToolPermission(profile, "shell").allowed).toBe(false);
      expect(checkToolPermission(profile, "exec").allowed).toBe(false);
    });

    it("minimal allows read tools", () => {
      const profile = getProfile("minimal");
      expect(checkToolPermission(profile, "file_read").allowed).toBe(true);
      expect(checkToolPermission(profile, "search").allowed).toBe(true);
      expect(checkToolPermission(profile, "list_files").allowed).toBe(true);
    });

    it("minimal blocks write tools via wildcard deny", () => {
      const profile = getProfile("minimal");
      expect(checkToolPermission(profile, "file_write").allowed).toBe(false);
      expect(checkToolPermission(profile, "file_edit").allowed).toBe(false);
      expect(checkToolPermission(profile, "file_delete").allowed).toBe(false);
    });

    it("minimal allows get_* tools via wildcard", () => {
      const profile = getProfile("minimal");
      expect(checkToolPermission(profile, "get_status").allowed).toBe(true);
      expect(checkToolPermission(profile, "get_info").allowed).toBe(true);
    });

    it("standard allows file operations", () => {
      const profile = getProfile("standard");
      expect(checkToolPermission(profile, "file_read").allowed).toBe(true);
      expect(checkToolPermission(profile, "file_write").allowed).toBe(true);
      expect(checkToolPermission(profile, "file_edit").allowed).toBe(true);
    });

    it("standard requires approval for bash", () => {
      const profile = getProfile("standard");
      const result = checkToolPermission(profile, "bash");
      expect(result.allowed).toBe(false); // not in allow list
      expect(result.requiresApproval).toBe(false); // denied before approval check
    });

    it("standard blocks config tools", () => {
      const profile = getProfile("standard");
      expect(checkToolPermission(profile, "config_set").allowed).toBe(false);
      expect(checkToolPermission(profile, "cron_create").allowed).toBe(false);
    });

    it("power allows most tools via wildcard", () => {
      const profile = getProfile("power");
      expect(checkToolPermission(profile, "file_read").allowed).toBe(true);
      expect(checkToolPermission(profile, "bash").allowed).toBe(true);
      expect(checkToolPermission(profile, "web_search").allowed).toBe(true);
    });

    it("power requires approval for config tools", () => {
      const profile = getProfile("power");
      const result = checkToolPermission(profile, "config_set");
      expect(result.allowed).toBe(true);
      expect(result.requiresApproval).toBe(true);
    });

    it("power denies sudo", () => {
      const profile = getProfile("power");
      expect(checkToolPermission(profile, "sudo").allowed).toBe(false);
    });

    it("unrestricted allows everything", () => {
      const profile = getProfile("unrestricted");
      expect(checkToolPermission(profile, "bash").allowed).toBe(true);
      expect(checkToolPermission(profile, "config_set").allowed).toBe(true);
      expect(checkToolPermission(profile, "gateway_restart").allowed).toBe(true);
      expect(checkToolPermission(profile, "anything_at_all").allowed).toBe(true);
    });

    it("unrestricted requires no approvals", () => {
      const profile = getProfile("unrestricted");
      const result = checkToolPermission(profile, "config_set");
      expect(result.requiresApproval).toBe(false);
    });

    it("unknown tool falls through to default deny on minimal", () => {
      const profile = getProfile("minimal");
      const result = checkToolPermission(profile, "unknown_tool_xyz");
      expect(result.allowed).toBe(false);
      expect(result.reason).toContain("not in the allow list");
    });

    it("includes the profile name in the reason", () => {
      const profile = getProfile("standard");
      const result = checkToolPermission(profile, "file_read");
      expect(result.reason).toContain("standard");
    });
  });

  describe("checkPathPermission", () => {
    it("allows workspace paths under standard", () => {
      const profile = getProfile("standard");
      const result = checkPathPermission(profile, "~/projects/my-app/src/index.ts");
      expect(result.allowed).toBe(true);
    });

    it("blocks ~/.ssh under standard", () => {
      const profile = getProfile("standard");
      const result = checkPathPermission(profile, "~/.ssh/id_rsa");
      expect(result.allowed).toBe(false);
      expect(result.reason).toContain("blocked");
    });

    it("blocks ~/.aws under minimal", () => {
      const profile = getProfile("minimal");
      const result = checkPathPermission(profile, "~/.aws/credentials");
      expect(result.allowed).toBe(false);
    });

    it("blocks /etc under minimal", () => {
      const profile = getProfile("minimal");
      const result = checkPathPermission(profile, "/etc/passwd");
      expect(result.allowed).toBe(false);
    });

    it("unrestricted allows any path", () => {
      const profile = getProfile("unrestricted");
      expect(checkPathPermission(profile, "~/.ssh/id_rsa").allowed).toBe(true);
      expect(checkPathPermission(profile, "/etc/passwd").allowed).toBe(true);
    });

    it("power has no blocked paths", () => {
      const profile = getProfile("power");
      expect(checkPathPermission(profile, "~/.ssh/id_rsa").allowed).toBe(true);
    });

    it("standard rejects paths outside allowed directories", () => {
      const profile = getProfile("standard");
      const result = checkPathPermission(profile, "/opt/secret/data");
      expect(result.allowed).toBe(false);
    });
  });

  describe("describeProfile", () => {
    it("returns readable text for each profile", () => {
      for (const name of ["minimal", "standard", "power", "unrestricted"] as ProfileName[]) {
        const text = describeProfile(name);
        expect(text).toContain(`Profile: ${name}`);
        expect(text).toContain("Sandbox:");
        expect(text).toContain("Shell:");
        expect(text).toContain("Network:");
      }
    });

    it("minimal shows shell disabled", () => {
      expect(describeProfile("minimal")).toContain("Shell: no");
    });

    it("power shows config changes enabled", () => {
      expect(describeProfile("power")).toContain("Config changes: yes");
    });
  });

  describe("compareProfiles", () => {
    it("shows differences between minimal and unrestricted", () => {
      const diff = compareProfiles("minimal", "unrestricted");
      expect(diff.length).toBeGreaterThan(0);

      const shellRow = diff.find((r) => r.aspect === "Shell access");
      expect(shellRow).toBeDefined();
      expect(shellRow!.profileA).toBe("false");
      expect(shellRow!.profileB).toBe("true");
    });

    it("returns consistent aspect keys", () => {
      const diff = compareProfiles("standard", "power");
      const aspects = diff.map((r) => r.aspect);
      expect(aspects).toContain("Sandbox");
      expect(aspects).toContain("Shell access");
      expect(aspects).toContain("Network access");
      expect(aspects).toContain("Blocked paths");
    });

    it("same profile comparison shows equal values", () => {
      const diff = compareProfiles("standard", "standard");
      for (const row of diff) {
        expect(row.profileA).toBe(row.profileB);
      }
    });
  });
});
