import { describe, expect, it } from "vitest";
import { shortenText } from "./text-format.js";

describe("shortenText", () => {
  it("returns original text when it fits", () => {
    expect(shortenText("godseye", 16)).toBe("godseye");
  });

  it("truncates and appends ellipsis when over limit", () => {
    expect(shortenText("godseye-status-output", 10)).toBe("godseye-…");
  });

  it("counts multi-byte characters correctly", () => {
    expect(shortenText("hello🙂world", 7)).toBe("hello🙂…");
  });
});
