import { describe, expect, it } from "vitest";
import {
  type AutonomyConfig,
  DEFAULT_AUTONOMY_CONFIG,
  classifyToolRisk,
  describeAutonomy,
  evaluateToolCall,
  updateTrust,
} from "./autonomy-governor.js";

describe("classifyToolRisk", () => {
  it("classifies read-only tools as safe", () => {
    expect(classifyToolRisk("file_read")).toBe("safe");
    expect(classifyToolRisk("list_files")).toBe("safe");
    expect(classifyToolRisk("search")).toBe("safe");
    expect(classifyToolRisk("status")).toBe("safe");
    expect(classifyToolRisk("web_search")).toBe("safe");
    expect(classifyToolRisk("get_config")).toBe("safe");
    expect(classifyToolRisk("read_file")).toBe("safe");
    expect(classifyToolRisk("show_status")).toBe("safe");
    expect(classifyToolRisk("describe_agent")).toBe("safe");
  });

  it("classifies write tools as moderate", () => {
    expect(classifyToolRisk("file_write")).toBe("moderate");
    expect(classifyToolRisk("file_edit")).toBe("moderate");
    expect(classifyToolRisk("git_commit")).toBe("moderate");
    expect(classifyToolRisk("send_message")).toBe("moderate");
    expect(classifyToolRisk("write_file")).toBe("moderate");
    expect(classifyToolRisk("edit_config")).toBe("moderate");
    expect(classifyToolRisk("update_record")).toBe("moderate");
    expect(classifyToolRisk("create_branch")).toBe("moderate");
  });

  it("classifies exec tools as dangerous", () => {
    expect(classifyToolRisk("bash")).toBe("dangerous");
    expect(classifyToolRisk("shell")).toBe("dangerous");
    expect(classifyToolRisk("exec")).toBe("dangerous");
    expect(classifyToolRisk("run_command")).toBe("dangerous");
    expect(classifyToolRisk("npm_install")).toBe("dangerous");
    expect(classifyToolRisk("pip_install")).toBe("dangerous");
    expect(classifyToolRisk("spawn")).toBe("dangerous");
    expect(classifyToolRisk("install_package")).toBe("dangerous");
  });

  it("classifies system tools as critical", () => {
    expect(classifyToolRisk("config_set")).toBe("critical");
    expect(classifyToolRisk("gateway_restart")).toBe("critical");
    expect(classifyToolRisk("cron_create")).toBe("critical");
    expect(classifyToolRisk("cron")).toBe("critical");
    expect(classifyToolRisk("delete_file")).toBe("critical");
    expect(classifyToolRisk("rm")).toBe("critical");
    expect(classifyToolRisk("sudo")).toBe("critical");
    expect(classifyToolRisk("chmod")).toBe("critical");
    expect(classifyToolRisk("chown")).toBe("critical");
    expect(classifyToolRisk("gateway")).toBe("critical");
    expect(classifyToolRisk("restart_service")).toBe("critical");
  });

  it("defaults unknown tools to moderate", () => {
    expect(classifyToolRisk("unknown_tool")).toBe("moderate");
    expect(classifyToolRisk("some_custom_thing")).toBe("moderate");
  });

  it("is case-insensitive", () => {
    expect(classifyToolRisk("FILE_READ")).toBe("safe");
    expect(classifyToolRisk("BASH")).toBe("dangerous");
    expect(classifyToolRisk("Sudo")).toBe("critical");
  });
});

describe("evaluateToolCall", () => {
  const supervised: AutonomyConfig = { ...DEFAULT_AUTONOMY_CONFIG, level: "supervised" };
  const semi: AutonomyConfig = { ...DEFAULT_AUTONOMY_CONFIG, level: "semi-autonomous" };
  const autonomous: AutonomyConfig = { ...DEFAULT_AUTONOMY_CONFIG, level: "autonomous" };

  it("supervised: allows safe, pauses moderate, blocks dangerous and critical", () => {
    expect(evaluateToolCall("file_read", {}, supervised).action).toBe("allow");
    expect(evaluateToolCall("file_write", {}, supervised).action).toBe("pause");
    expect(evaluateToolCall("file_write", {}, supervised).requiresApproval).toBe(true);
    expect(evaluateToolCall("bash", {}, supervised).action).toBe("block");
    expect(evaluateToolCall("sudo", {}, supervised).action).toBe("block");
  });

  it("semi-autonomous: allows safe+moderate, pauses dangerous, blocks critical", () => {
    expect(evaluateToolCall("file_read", {}, semi).action).toBe("allow");
    expect(evaluateToolCall("file_write", {}, semi).action).toBe("allow");
    expect(evaluateToolCall("bash", {}, semi).action).toBe("pause");
    expect(evaluateToolCall("bash", {}, semi).requiresApproval).toBe(true);
    expect(evaluateToolCall("sudo", {}, semi).action).toBe("block");
  });

  it("autonomous: allows safe+moderate+dangerous, pauses critical", () => {
    expect(evaluateToolCall("file_read", {}, autonomous).action).toBe("allow");
    expect(evaluateToolCall("file_write", {}, autonomous).action).toBe("allow");
    expect(evaluateToolCall("bash", {}, autonomous).action).toBe("allow");
    expect(evaluateToolCall("sudo", {}, autonomous).action).toBe("pause");
    expect(evaluateToolCall("sudo", {}, autonomous).requiresApproval).toBe(true);
  });

  it("includes tool name and risk in reason", () => {
    const decision = evaluateToolCall("bash", {}, supervised);
    expect(decision.reason).toContain("bash");
    expect(decision.reason).toContain("dangerous");
    expect(decision.riskLevel).toBe("dangerous");
  });
});

describe("updateTrust", () => {
  it("increments trust by 2 on success", () => {
    const config: AutonomyConfig = { ...DEFAULT_AUTONOMY_CONFIG, trustScore: 10 };
    const result = updateTrust(config, "success");
    expect(result.newScore).toBe(12);
    expect(result.levelChanged).toBe(false);
  });

  it("decrements trust by 5 on failure", () => {
    const config: AutonomyConfig = { ...DEFAULT_AUTONOMY_CONFIG, trustScore: 20 };
    const result = updateTrust(config, "failure");
    expect(result.newScore).toBe(15);
    expect(result.levelChanged).toBe(false);
  });

  it("decrements trust by 20 on critical failure", () => {
    const config: AutonomyConfig = { ...DEFAULT_AUTONOMY_CONFIG, trustScore: 50 };
    const result = updateTrust(config, "critical_failure");
    expect(result.newScore).toBe(30);
  });

  it("caps trust score at 100", () => {
    const config: AutonomyConfig = { ...DEFAULT_AUTONOMY_CONFIG, trustScore: 99 };
    const result = updateTrust(config, "success");
    expect(result.newScore).toBe(100);
  });

  it("floors trust score at 0", () => {
    const config: AutonomyConfig = { ...DEFAULT_AUTONOMY_CONFIG, trustScore: 3 };
    const result = updateTrust(config, "failure");
    expect(result.newScore).toBe(0);
  });

  it("auto-escalates from supervised to semi-autonomous at score 50", () => {
    const config: AutonomyConfig = {
      ...DEFAULT_AUTONOMY_CONFIG,
      level: "supervised",
      trustScore: 49,
    };
    const result = updateTrust(config, "success");
    expect(result.newScore).toBe(51);
    expect(result.levelChanged).toBe(true);
    expect(result.newLevel).toBe("semi-autonomous");
  });

  it("auto-escalates from semi-autonomous to autonomous at score 75", () => {
    const config: AutonomyConfig = {
      ...DEFAULT_AUTONOMY_CONFIG,
      level: "semi-autonomous",
      trustScore: 74,
    };
    const result = updateTrust(config, "success");
    expect(result.newScore).toBe(76);
    expect(result.levelChanged).toBe(true);
    expect(result.newLevel).toBe("autonomous");
  });

  it("does not escalate beyond autonomous", () => {
    const config: AutonomyConfig = {
      ...DEFAULT_AUTONOMY_CONFIG,
      level: "autonomous",
      trustScore: 98,
    };
    const result = updateTrust(config, "success");
    expect(result.newScore).toBe(100);
    expect(result.levelChanged).toBe(false);
    expect(result.newLevel).toBeUndefined();
  });

  it("auto-deescalates on critical failure when enabled", () => {
    const config: AutonomyConfig = {
      ...DEFAULT_AUTONOMY_CONFIG,
      level: "autonomous",
      trustScore: 80,
      autoDeescalateOnFailure: true,
    };
    const result = updateTrust(config, "critical_failure");
    expect(result.levelChanged).toBe(true);
    expect(result.newLevel).toBe("semi-autonomous");
    expect(result.newScore).toBe(60);
  });

  it("does not deescalate on critical failure when disabled", () => {
    const config: AutonomyConfig = {
      ...DEFAULT_AUTONOMY_CONFIG,
      level: "semi-autonomous",
      trustScore: 60,
      autoDeescalateOnFailure: false,
    };
    const result = updateTrust(config, "critical_failure");
    expect(result.levelChanged).toBe(false);
    expect(result.newLevel).toBeUndefined();
    expect(result.newScore).toBe(40);
  });

  it("does not deescalate below supervised", () => {
    const config: AutonomyConfig = {
      ...DEFAULT_AUTONOMY_CONFIG,
      level: "supervised",
      trustScore: 10,
      autoDeescalateOnFailure: true,
    };
    const result = updateTrust(config, "critical_failure");
    expect(result.levelChanged).toBe(false);
    expect(result.newLevel).toBeUndefined();
    expect(result.newScore).toBe(0);
  });

  it("includes reason string with score transition", () => {
    const config: AutonomyConfig = { ...DEFAULT_AUTONOMY_CONFIG, trustScore: 10 };
    const result = updateTrust(config, "success");
    expect(result.reason).toContain("10");
    expect(result.reason).toContain("12");
    expect(result.reason).toContain("success");
  });
});

describe("describeAutonomy", () => {
  it("describes supervised level with escalation info", () => {
    const config: AutonomyConfig = { ...DEFAULT_AUTONOMY_CONFIG, trustScore: 30 };
    const desc = describeAutonomy(config);
    expect(desc).toContain("supervised");
    expect(desc).toContain("30/100");
    expect(desc).toContain("20 points until auto-escalation to semi-autonomous");
  });

  it("describes autonomous level as maximum", () => {
    const config: AutonomyConfig = {
      ...DEFAULT_AUTONOMY_CONFIG,
      level: "autonomous",
      trustScore: 90,
    };
    const desc = describeAutonomy(config);
    expect(desc).toContain("autonomous");
    expect(desc).toContain("90/100");
    expect(desc).toContain("Maximum autonomy level reached");
  });

  it("shows eligible for escalation when at threshold", () => {
    const config: AutonomyConfig = {
      ...DEFAULT_AUTONOMY_CONFIG,
      level: "supervised",
      trustScore: 50,
    };
    const desc = describeAutonomy(config);
    expect(desc).toContain("Eligible for escalation to semi-autonomous");
  });

  it("shows deescalation status", () => {
    const config: AutonomyConfig = { ...DEFAULT_AUTONOMY_CONFIG, autoDeescalateOnFailure: true };
    const desc = describeAutonomy(config);
    expect(desc).toContain("Auto-deescalation on critical failure: enabled");
  });

  it("omits deescalation line when disabled", () => {
    const config: AutonomyConfig = { ...DEFAULT_AUTONOMY_CONFIG, autoDeescalateOnFailure: false };
    const desc = describeAutonomy(config);
    expect(desc).not.toContain("Auto-deescalation");
  });
});
