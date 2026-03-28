import { beforeEach, describe, expect, it, vi } from "vitest";

// Mock node:fs/promises so we never touch the real filesystem.
const fsMocks = vi.hoisted(() => ({
  readFile: vi.fn(),
  writeFile: vi.fn(async () => {}),
  mkdir: vi.fn(async () => undefined as unknown),
  chmod: vi.fn(async () => {}),
}));

vi.mock("node:fs/promises", () => fsMocks);

// Capture stderr writes for assertion without polluting test output.
const stderrSpy = vi.hoisted(() => vi.fn());

import {
  checkTokenSecurity,
  ensureGatewayToken,
  generateToken,
  getTokenFilePath,
  validateGatewayToken,
} from "./auto-token.js";

beforeEach(() => {
  vi.restoreAllMocks();
  fsMocks.readFile.mockReset();
  fsMocks.writeFile.mockReset();
  fsMocks.mkdir.mockReset();
  fsMocks.chmod.mockReset();
  stderrSpy.mockReset();
  vi.spyOn(process.stderr, "write").mockImplementation(stderrSpy);
});

// ---------------------------------------------------------------------------
// generateToken
// ---------------------------------------------------------------------------
describe("generateToken", () => {
  it("produces a 64-char hex string by default (32 bytes)", () => {
    const token = generateToken();
    expect(token).toMatch(/^[0-9a-f]{64}$/);
  });

  it("respects custom byte length", () => {
    const token = generateToken(16);
    // 16 bytes = 32 hex chars
    expect(token).toMatch(/^[0-9a-f]{32}$/);
  });

  it("produces unique tokens on successive calls", () => {
    const a = generateToken();
    const b = generateToken();
    expect(a).not.toBe(b);
  });
});

// ---------------------------------------------------------------------------
// getTokenFilePath
// ---------------------------------------------------------------------------
describe("getTokenFilePath", () => {
  it("returns a path ending with .godseye/gateway-token", () => {
    const p = getTokenFilePath();
    expect(p).toMatch(/\.godseye[/\\]gateway-token$/);
  });
});

// ---------------------------------------------------------------------------
// checkTokenSecurity
// ---------------------------------------------------------------------------
describe("checkTokenSecurity", () => {
  it.each(["change-me-to-a-long-random-token", "change-me", "test", "default", ""])(
    "flags known insecure token: %j",
    (token) => {
      expect(checkTokenSecurity(token)).not.toBeNull();
    },
  );

  it("flags short tokens (< 16 chars)", () => {
    expect(checkTokenSecurity("abc123")).not.toBeNull();
  });

  it("returns null for a secure hex token", () => {
    const secure = generateToken();
    expect(checkTokenSecurity(secure)).toBeNull();
  });

  it("returns null for a 16-char token", () => {
    expect(checkTokenSecurity("abcdef0123456789")).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// ensureGatewayToken
// ---------------------------------------------------------------------------
describe("ensureGatewayToken", () => {
  it("returns existing token from disk when present", async () => {
    fsMocks.readFile.mockResolvedValue("existing-secure-token-value\n");

    const token = await ensureGatewayToken();
    expect(token).toBe("existing-secure-token-value");
    expect(fsMocks.writeFile).not.toHaveBeenCalled();
  });

  it("generates and persists a new token when file is missing", async () => {
    const enoent = Object.assign(new Error("ENOENT"), { code: "ENOENT" });
    fsMocks.readFile.mockRejectedValue(enoent);

    const token = await ensureGatewayToken();

    // Should be a valid 64-char hex token.
    expect(token).toMatch(/^[0-9a-f]{64}$/);

    // Should have created the directory and written the file.
    expect(fsMocks.mkdir).toHaveBeenCalledWith(expect.stringContaining(".godseye"), {
      recursive: true,
    });
    expect(fsMocks.writeFile).toHaveBeenCalledWith(
      expect.stringContaining("gateway-token"),
      `${token}\n`,
      { mode: 0o600 },
    );
    expect(fsMocks.chmod).toHaveBeenCalledWith(expect.stringContaining("gateway-token"), 0o600);

    // Should have notified via stderr.
    expect(stderrSpy).toHaveBeenCalledWith(expect.stringContaining("Generated new gateway token"));
  });

  it("generates a new token when file exists but is empty", async () => {
    fsMocks.readFile.mockResolvedValue("   \n");

    const token = await ensureGatewayToken();
    expect(token).toMatch(/^[0-9a-f]{64}$/);
    expect(fsMocks.writeFile).toHaveBeenCalled();
  });

  it("re-throws unexpected read errors", async () => {
    fsMocks.readFile.mockRejectedValue(Object.assign(new Error("EACCES"), { code: "EACCES" }));
    await expect(ensureGatewayToken()).rejects.toThrow("EACCES");
  });
});

// ---------------------------------------------------------------------------
// validateGatewayToken
// ---------------------------------------------------------------------------
describe("validateGatewayToken", () => {
  it("throws for insecure token without --force", async () => {
    await expect(validateGatewayToken("test")).rejects.toThrow(/insecure.*--force/i);
  });

  it("prints warning but does not throw with --force", async () => {
    await expect(validateGatewayToken("test", { force: true })).resolves.toBeUndefined();
    expect(stderrSpy).toHaveBeenCalledWith(expect.stringContaining("WARNING"));
  });

  it("does nothing for a secure token", async () => {
    const secure = generateToken();
    await expect(validateGatewayToken(secure)).resolves.toBeUndefined();
    expect(stderrSpy).not.toHaveBeenCalled();
  });
});
