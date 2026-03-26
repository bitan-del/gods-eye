import { describe, expect, it } from "vitest";
import { resolveIrcInboundTarget } from "./monitor.js";

describe("irc monitor inbound target", () => {
  it("keeps channel target for group messages", () => {
    expect(
      resolveIrcInboundTarget({
        target: "#godseye",
        senderNick: "alice",
      }),
    ).toEqual({
      isGroup: true,
      target: "#godseye",
      rawTarget: "#godseye",
    });
  });

  it("maps DM target to sender nick and preserves raw target", () => {
    expect(
      resolveIrcInboundTarget({
        target: "godseye-bot",
        senderNick: "alice",
      }),
    ).toEqual({
      isGroup: false,
      target: "alice",
      rawTarget: "godseye-bot",
    });
  });

  it("falls back to raw target when sender nick is empty", () => {
    expect(
      resolveIrcInboundTarget({
        target: "godseye-bot",
        senderNick: " ",
      }),
    ).toEqual({
      isGroup: false,
      target: "godseye-bot",
      rawTarget: "godseye-bot",
    });
  });
});
