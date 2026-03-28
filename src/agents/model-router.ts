/**
 * RouteLLM-inspired smart model router.
 *
 * Classifies task complexity using pure heuristics (no ML/embeddings) and
 * recommends a model tier (cheap / mid / expensive) accordingly.
 */

export type TaskComplexity = "simple" | "moderate" | "complex";

export interface RoutingDecision {
  complexity: TaskComplexity;
  recommendedTier: "cheap" | "mid" | "expensive";
  reason: string;
  confidence: number; // 0.0 - 1.0
}

export interface ModelTierConfig {
  cheap: string[]; // e.g. ["gemini-flash-lite", "gpt-mini", "haiku"]
  mid: string[]; // e.g. ["sonnet", "gpt", "gemini-flash"]
  expensive: string[]; // e.g. ["opus", "gpt-4o", "gemini-pro"]
}

export const DEFAULT_TIER_CONFIG: ModelTierConfig = {
  cheap: ["gemini-flash-lite", "gpt-mini", "haiku"],
  mid: ["sonnet", "gpt", "gemini-flash"],
  expensive: ["opus", "gpt-4o", "gemini-pro"],
};

// -- Pattern sets for heuristic classification --

const SIMPLE_COMMAND_PATTERNS =
  /^(list|show|status|help|version|ping|hi|hello|hey|thanks|ok|yes|no|sure|got it)\b/i;

const SIMPLE_QUESTION_PATTERNS =
  /^(what is|what's|who is|who's|when was|when is|where is|where's|how do i|how to|can you|could you|define|tell me about)\b/i;

const COMPLEX_REASONING_PATTERNS =
  /\b(analyze|analyse|design|architect|compare|evaluate|refactor|optimize|debug|investigate|implement|plan|strategy|trade-?offs?|pros and cons|step[- ]by[- ]step|end[- ]to[- ]end)\b/i;

const COMPLEX_CREATION_PATTERNS =
  /\b(create (?:a |an |a new |an new )?(?:file|module|class|component|service|system|api|schema|database|test suite))\b/i;

const TOOL_REQUEST_PATTERNS =
  /\b(search|find|read|write|edit|delete|open|run|execute|fetch|download|upload|deploy|install|build|compile)\b/i;

const CODE_CONTEXT_PATTERNS =
  /\b(function|class|interface|type|import|export|const|let|var|async|await|return|if|else|for|while|switch|try|catch|throw)\b/;

const MULTI_PART_PATTERNS =
  /\b(also|then|after that|additionally|furthermore|next|finally|first|second|third)\b/i;

function countWords(input: string): number {
  const trimmed = input.trim();
  if (!trimmed) {
    return 0;
  }
  return trimmed.split(/\s+/).length;
}
// -- Complexity classification --

export interface ClassifyContext {
  toolsRequested?: string[];
  conversationLength?: number;
  hasCodeContext?: boolean;
}

/**
 * Analyze a user message/task to determine complexity using rule-based
 * heuristics. Returns a routing decision with confidence score.
 */
export function classifyComplexity(input: string, context?: ClassifyContext): RoutingDecision {
  const trimmed = input.trim();
  const wordCount = countWords(trimmed);

  // Empty or near-empty input is trivially simple.
  if (wordCount === 0) {
    return {
      complexity: "simple",
      recommendedTier: "cheap",
      reason: "empty input",
      confidence: 1.0,
    };
  }

  // Accumulate a numeric score: negative = simpler, positive = more complex.
  let score = 0;
  const reasons: string[] = [];

  // --- Length signals ---
  if (wordCount < 10) {
    score -= 2;
    reasons.push("very short message");
  } else if (wordCount < 50) {
    score -= 1;
    reasons.push("short message");
  } else if (wordCount > 200) {
    score += 2;
    reasons.push("long message (>200 words)");
  } else if (wordCount > 50) {
    score += 1;
    reasons.push("medium-length message");
  }

  // --- Pattern signals ---
  if (SIMPLE_COMMAND_PATTERNS.test(trimmed)) {
    score -= 2;
    reasons.push("simple command pattern");
  }

  if (SIMPLE_QUESTION_PATTERNS.test(trimmed)) {
    score -= 1;
    reasons.push("factual question pattern");
  }

  // Count distinct complex-reasoning keyword matches for stronger signal.
  const complexMatches = trimmed.match(COMPLEX_REASONING_PATTERNS);
  if (complexMatches) {
    // Use global regex to count all distinct matches.
    const allMatches = trimmed.match(
      /\b(analyze|analyse|design|architect|compare|evaluate|refactor|optimize|debug|investigate|implement|plan|strategy|trade-?offs?|pros and cons|step[- ]by[- ]step|end[- ]to[- ]end)\b/gi,
    );
    const matchCount = allMatches ? allMatches.length : 1;
    const boost = Math.min(2 + matchCount, 5);
    score += boost;
    reasons.push(`complex reasoning keywords (${matchCount} match${matchCount > 1 ? "es" : ""})`);
  }

  if (COMPLEX_CREATION_PATTERNS.test(trimmed)) {
    score += 2;
    reasons.push("complex creation request");
  }

  if (TOOL_REQUEST_PATTERNS.test(trimmed)) {
    score += 1;
    reasons.push("tool use request");
  }

  if (CODE_CONTEXT_PATTERNS.test(trimmed)) {
    score += 1;
    reasons.push("contains code constructs");
  }

  if (MULTI_PART_PATTERNS.test(trimmed)) {
    score += 1;
    reasons.push("multi-part request");
  }

  // Count question marks as a proxy for multi-part questions.
  const questionCount = (trimmed.match(/\?/g) || []).length;
  if (questionCount > 1) {
    score += 1;
    reasons.push("multiple questions");
  }

  // --- Context signals ---
  if (context?.toolsRequested && context.toolsRequested.length > 0) {
    const toolBoost = Math.min(context.toolsRequested.length, 3);
    score += toolBoost;
    reasons.push(`${context.toolsRequested.length} tool(s) requested`);
  }

  if (context?.conversationLength != null && context.conversationLength > 10) {
    score += 1;
    reasons.push("long conversation context");
  }

  if (context?.hasCodeContext) {
    score += 1;
    reasons.push("code context present");
  }

  // --- Map score to complexity tier ---
  let complexity: TaskComplexity;
  let recommendedTier: "cheap" | "mid" | "expensive";
  let confidence: number;

  if (score <= -2) {
    complexity = "simple";
    recommendedTier = "cheap";
    confidence = Math.min(0.95, 0.7 + Math.abs(score) * 0.05);
  } else if (score <= 1) {
    complexity = "moderate";
    recommendedTier = "mid";
    // Confidence is lower near the boundaries.
    confidence = 0.6 + (1 - Math.abs(score) / 2) * 0.15;
  } else {
    complexity = "complex";
    recommendedTier = "expensive";
    confidence = Math.min(0.95, 0.7 + score * 0.05);
  }

  return {
    complexity,
    recommendedTier,
    reason: reasons.join("; "),
    confidence: Math.round(confidence * 100) / 100,
  };
}

// -- Model recommendation --

/**
 * Pick the best model alias from the appropriate tier, optionally filtering
 * by provider name substring.
 */
export function getRecommendedModel(
  decision: RoutingDecision,
  tiers: ModelTierConfig,
  preferredProvider?: string,
): string {
  const tierModels = tiers[decision.recommendedTier];
  if (!tierModels || tierModels.length === 0) {
    // Fallback: try mid, then cheap, then first available in any tier.
    const fallbackOrder: Array<keyof ModelTierConfig> = ["mid", "cheap", "expensive"];
    for (const tier of fallbackOrder) {
      if (tiers[tier] && tiers[tier].length > 0) {
        return tiers[tier][0];
      }
    }
    return "sonnet"; // ultimate fallback
  }

  if (preferredProvider) {
    const lower = preferredProvider.toLowerCase();
    const match = tierModels.find((m) => m.toLowerCase().includes(lower));
    if (match) {
      return match;
    }
  }

  return tierModels[0];
}

// -- Full routing pipeline --

export interface RouteContext extends ClassifyContext {
  tiers?: ModelTierConfig;
  preferredProvider?: string;
}

/**
 * Full routing: classify complexity then recommend a model alias.
 */
export function routeToModel(
  input: string,
  context?: RouteContext,
): { decision: RoutingDecision; model: string } {
  const decision = classifyComplexity(input, context);
  const tiers = context?.tiers ?? DEFAULT_TIER_CONFIG;
  const model = getRecommendedModel(decision, tiers, context?.preferredProvider);
  return { decision, model };
}
