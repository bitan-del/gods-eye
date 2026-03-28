import { describe, expect, it } from "vitest";
import {
  type ModelTierConfig,
  type RoutingDecision,
  DEFAULT_TIER_CONFIG,
  classifyComplexity,
  getRecommendedModel,
  routeToModel,
} from "./model-router.js";

// ---------------------------------------------------------------------------
// classifyComplexity
// ---------------------------------------------------------------------------

describe("classifyComplexity", () => {
  describe("simple messages", () => {
    it("classifies a greeting as simple", () => {
      const result = classifyComplexity("hello");
      expect(result.complexity).toBe("simple");
      expect(result.recommendedTier).toBe("cheap");
    });

    it("classifies a factual question as simple", () => {
      const result = classifyComplexity("what is TypeScript?");
      expect(result.complexity).toBe("simple");
      expect(result.recommendedTier).toBe("cheap");
    });

    it("classifies a status check as simple", () => {
      const result = classifyComplexity("status");
      expect(result.complexity).toBe("simple");
      expect(result.recommendedTier).toBe("cheap");
    });

    it("classifies a short acknowledgment as simple", () => {
      const result = classifyComplexity("ok");
      expect(result.complexity).toBe("simple");
      expect(result.recommendedTier).toBe("cheap");
    });

    it("classifies 'help' as simple", () => {
      const result = classifyComplexity("help");
      expect(result.complexity).toBe("simple");
      expect(result.recommendedTier).toBe("cheap");
    });
  });

  describe("moderate messages", () => {
    it("classifies a tool request as moderate", () => {
      const result = classifyComplexity(
        "search for all TypeScript files that import the config module",
      );
      expect(result.complexity).toBe("moderate");
      expect(result.recommendedTier).toBe("mid");
    });

    it("classifies a code review request as moderate", () => {
      const result = classifyComplexity(
        "read the function handleRequest in server.ts and tell me if there are any issues",
      );
      expect(result.complexity).toBe("moderate");
      expect(result.recommendedTier).toBe("mid");
    });

    it("boosts complexity when tools are requested in context", () => {
      const result = classifyComplexity("what is the current status?", {
        toolsRequested: ["file_read", "web_search"],
      });
      // The tool context should push it up from simple.
      expect(result.recommendedTier).not.toBe("cheap");
    });
  });

  describe("complex messages", () => {
    it("classifies architecture request as complex", () => {
      const result = classifyComplexity(
        "analyze the current authentication system and design a new architecture that supports OAuth, SAML, and API keys with proper separation of concerns",
      );
      expect(result.complexity).toBe("complex");
      expect(result.recommendedTier).toBe("expensive");
    });

    it("classifies multi-step debugging as complex", () => {
      const result = classifyComplexity(
        "debug the memory leak in the WebSocket handler. Investigate the connection pool, analyze the event listeners, and evaluate whether we need to refactor the cleanup logic",
      );
      expect(result.complexity).toBe("complex");
      expect(result.recommendedTier).toBe("expensive");
    });

    it("classifies file creation request as complex", () => {
      const result = classifyComplexity(
        "create a new module for handling rate limiting with a token bucket algorithm, including the interface, implementation, and configuration options",
      );
      expect(result.complexity).toBe("complex");
      expect(result.recommendedTier).toBe("expensive");
    });

    it("classifies comparison/evaluation as complex", () => {
      const result = classifyComplexity(
        "compare the trade-offs between using Redis vs Memcached for our caching layer. Evaluate performance, consistency, and operational complexity",
      );
      expect(result.complexity).toBe("complex");
      expect(result.recommendedTier).toBe("expensive");
    });
  });

  describe("context boosting", () => {
    it("boosts complexity for multiple tools", () => {
      const base = classifyComplexity("check the logs");
      const boosted = classifyComplexity("check the logs", {
        toolsRequested: ["file_read", "web_search", "code_search"],
      });
      expect(boosted.recommendedTier).not.toBe("cheap");
      // Score should be higher with tools.
      const tierOrder = { cheap: 0, mid: 1, expensive: 2 };
      expect(tierOrder[boosted.recommendedTier]).toBeGreaterThanOrEqual(
        tierOrder[base.recommendedTier],
      );
    });

    it("boosts complexity for long conversation", () => {
      const base = classifyComplexity("what about the error handling?");
      const boosted = classifyComplexity("what about the error handling?", {
        conversationLength: 15,
      });
      const tierOrder = { cheap: 0, mid: 1, expensive: 2 };
      expect(tierOrder[boosted.recommendedTier]).toBeGreaterThanOrEqual(
        tierOrder[base.recommendedTier],
      );
    });

    it("boosts complexity for code context", () => {
      const base = classifyComplexity("fix the issue");
      const boosted = classifyComplexity("fix the issue", { hasCodeContext: true });
      const tierOrder = { cheap: 0, mid: 1, expensive: 2 };
      expect(tierOrder[boosted.recommendedTier]).toBeGreaterThanOrEqual(
        tierOrder[base.recommendedTier],
      );
    });
  });

  describe("edge cases", () => {
    it("handles empty input", () => {
      const result = classifyComplexity("");
      expect(result.complexity).toBe("simple");
      expect(result.recommendedTier).toBe("cheap");
      expect(result.confidence).toBe(1.0);
    });

    it("handles whitespace-only input", () => {
      const result = classifyComplexity("   ");
      expect(result.complexity).toBe("simple");
      expect(result.recommendedTier).toBe("cheap");
    });

    it("handles very long input", () => {
      const longInput = "analyze ".repeat(100) + "the system architecture and design a solution";
      const result = classifyComplexity(longInput);
      expect(result.complexity).toBe("complex");
      expect(result.recommendedTier).toBe("expensive");
    });

    it("returns confidence between 0 and 1", () => {
      const inputs = [
        "hello",
        "search for files",
        "analyze and design the entire system architecture",
      ];
      for (const input of inputs) {
        const result = classifyComplexity(input);
        expect(result.confidence).toBeGreaterThanOrEqual(0);
        expect(result.confidence).toBeLessThanOrEqual(1);
      }
    });

    it("always returns a non-empty reason", () => {
      const result = classifyComplexity("test");
      expect(result.reason.length).toBeGreaterThan(0);
    });
  });
});

// ---------------------------------------------------------------------------
// getRecommendedModel
// ---------------------------------------------------------------------------

describe("getRecommendedModel", () => {
  const decision = (tier: "cheap" | "mid" | "expensive"): RoutingDecision => ({
    complexity: tier === "cheap" ? "simple" : tier === "mid" ? "moderate" : "complex",
    recommendedTier: tier,
    reason: "test",
    confidence: 0.8,
  });

  it("returns first cheap model for simple tasks", () => {
    const model = getRecommendedModel(decision("cheap"), DEFAULT_TIER_CONFIG);
    expect(DEFAULT_TIER_CONFIG.cheap).toContain(model);
  });

  it("returns first mid model for moderate tasks", () => {
    const model = getRecommendedModel(decision("mid"), DEFAULT_TIER_CONFIG);
    expect(DEFAULT_TIER_CONFIG.mid).toContain(model);
  });

  it("returns first expensive model for complex tasks", () => {
    const model = getRecommendedModel(decision("expensive"), DEFAULT_TIER_CONFIG);
    expect(DEFAULT_TIER_CONFIG.expensive).toContain(model);
  });

  it("respects provider preference", () => {
    const model = getRecommendedModel(decision("cheap"), DEFAULT_TIER_CONFIG, "gpt");
    expect(model).toBe("gpt-mini");
  });

  it("falls back to first model when provider not found in tier", () => {
    const model = getRecommendedModel(decision("cheap"), DEFAULT_TIER_CONFIG, "nonexistent");
    expect(model).toBe(DEFAULT_TIER_CONFIG.cheap[0]);
  });

  it("falls back when tier is empty", () => {
    const sparseConfig: ModelTierConfig = {
      cheap: [],
      mid: ["sonnet"],
      expensive: [],
    };
    const model = getRecommendedModel(decision("cheap"), sparseConfig);
    expect(model).toBe("sonnet");
  });

  it("returns ultimate fallback when all tiers empty", () => {
    const emptyConfig: ModelTierConfig = { cheap: [], mid: [], expensive: [] };
    const model = getRecommendedModel(decision("cheap"), emptyConfig);
    expect(model).toBe("sonnet");
  });
});

// ---------------------------------------------------------------------------
// routeToModel (full pipeline)
// ---------------------------------------------------------------------------

describe("routeToModel", () => {
  it("routes a greeting to cheap model", () => {
    const { decision, model } = routeToModel("hi there");
    expect(decision.complexity).toBe("simple");
    expect(decision.recommendedTier).toBe("cheap");
    expect(DEFAULT_TIER_CONFIG.cheap).toContain(model);
  });

  it("routes a complex task to expensive model", () => {
    const { decision, model } = routeToModel(
      "analyze the codebase architecture and design a migration plan with step-by-step implementation",
    );
    expect(decision.complexity).toBe("complex");
    expect(decision.recommendedTier).toBe("expensive");
    expect(DEFAULT_TIER_CONFIG.expensive).toContain(model);
  });

  it("accepts custom tier config", () => {
    const customTiers: ModelTierConfig = {
      cheap: ["custom-small"],
      mid: ["custom-mid"],
      expensive: ["custom-large"],
    };
    const { model } = routeToModel("hello", { tiers: customTiers });
    expect(model).toBe("custom-small");
  });

  it("accepts preferred provider", () => {
    const { model } = routeToModel("hi", { preferredProvider: "gpt" });
    expect(model).toBe("gpt-mini");
  });

  it("returns both decision and model", () => {
    const result = routeToModel("hello");
    expect(result).toHaveProperty("decision");
    expect(result).toHaveProperty("model");
    expect(result.decision).toHaveProperty("complexity");
    expect(result.decision).toHaveProperty("recommendedTier");
    expect(result.decision).toHaveProperty("reason");
    expect(result.decision).toHaveProperty("confidence");
    expect(typeof result.model).toBe("string");
  });
});
