/**
 * Interactive first-run tutorial system for Gods Eye.
 *
 * Guides new users through provider setup, connection testing,
 * first message, tool exploration, and optional channel wiring.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface TutorialStep {
  id: string;
  title: string;
  description: string;
  action: string;
  validation?: () => boolean | Promise<boolean>;
  skippable: boolean;
}

export interface TutorialProgress {
  completedSteps: string[];
  currentStep: string;
  startedAt: number;
  lastResumedAt: number;
}

// ---------------------------------------------------------------------------
// Step definitions
// ---------------------------------------------------------------------------

export const TUTORIAL_STEPS: TutorialStep[] = [
  {
    id: "welcome",
    title: "Welcome to Gods Eye",
    description:
      "Gods Eye is a multi-channel AI gateway. This tutorial walks you through the essentials to get started.",
    action: "Press Enter to continue",
    skippable: false,
  },
  {
    id: "configure-provider",
    title: "Set Up AI Provider",
    description:
      "Configure your preferred AI provider (e.g. Anthropic, OpenAI) so Gods Eye can route messages to a model.",
    action: "Run `godseye config set provider <name>` to choose a provider",
    skippable: false,
  },
  {
    id: "test-connection",
    title: "Verify API Key",
    description:
      "Confirm that your API key is valid and the provider is reachable before sending real traffic.",
    action: "Run `godseye doctor` to verify connectivity",
    skippable: false,
  },
  {
    id: "first-message",
    title: "Send a Test Message",
    description:
      "Send a quick message through the gateway to make sure everything is wired up correctly.",
    action: 'Run `godseye message send "Hello, Gods Eye!"` to test',
    skippable: false,
  },
  {
    id: "explore-tools",
    title: "Learn About Available Tools",
    description:
      "Gods Eye supports tools and plugins that extend its capabilities. Explore what is available.",
    action: "Run `godseye status --all` to see installed plugins and tools",
    skippable: false,
  },
  {
    id: "setup-channel",
    title: "Connect a Messaging Channel",
    description:
      "Optionally connect a messaging channel such as Telegram, Discord, or Slack to start receiving messages.",
    action: "Run `godseye channels add` to connect a channel",
    skippable: true,
  },
  {
    id: "congratulations",
    title: "You're All Set!",
    description:
      "Congratulations — you have completed the Gods Eye tutorial. Explore the docs for advanced features.",
    action: "Visit https://docs.gods-eye.org for next steps",
    skippable: false,
  },
];

// ---------------------------------------------------------------------------
// Progress helpers
// ---------------------------------------------------------------------------

/** Create a fresh tutorial progress object pointing at the first step. */
export function createTutorialProgress(): TutorialProgress {
  return {
    completedSteps: [],
    currentStep: TUTORIAL_STEPS[0].id,
    startedAt: Date.now(),
    lastResumedAt: Date.now(),
  };
}

/** Move to the next step, marking the current one as completed. */
export function advanceStep(progress: TutorialProgress): TutorialProgress {
  const idx = TUTORIAL_STEPS.findIndex((s) => s.id === progress.currentStep);
  if (idx === -1 || idx >= TUTORIAL_STEPS.length - 1) {
    // Already at the last step (or unknown) — mark current complete and stay.
    if (idx !== -1 && !progress.completedSteps.includes(progress.currentStep)) {
      return {
        ...progress,
        completedSteps: [...progress.completedSteps, progress.currentStep],
        lastResumedAt: Date.now(),
      };
    }
    return { ...progress, lastResumedAt: Date.now() };
  }

  const completed = progress.completedSteps.includes(progress.currentStep)
    ? progress.completedSteps
    : [...progress.completedSteps, progress.currentStep];

  return {
    ...progress,
    completedSteps: completed,
    currentStep: TUTORIAL_STEPS[idx + 1].id,
    lastResumedAt: Date.now(),
  };
}

/**
 * Skip the current step if it is skippable.
 * Non-skippable steps are left unchanged.
 */
export function skipStep(progress: TutorialProgress): TutorialProgress {
  const step = getCurrentStep(progress);
  if (!step || !step.skippable) {
    return progress;
  }
  return advanceStep(progress);
}

/** Reset the tutorial back to the very first step. */
export function resetTutorial(): TutorialProgress {
  return createTutorialProgress();
}

/** Return the TutorialStep object for the current progress position. */
export function getCurrentStep(progress: TutorialProgress): TutorialStep | undefined {
  return TUTORIAL_STEPS.find((s) => s.id === progress.currentStep);
}

/** Compute completion percentage (0–100). */
export function getCompletionPercentage(progress: TutorialProgress): number {
  const total = TUTORIAL_STEPS.length;
  if (total === 0) {
    return 100;
  }
  return Math.round((progress.completedSteps.length / total) * 100);
}

// ---------------------------------------------------------------------------
// Display / formatting
// ---------------------------------------------------------------------------

/** Format a single step for terminal display. */
export function formatStepDisplay(step: TutorialStep, stepNumber: number, total: number): string {
  const tag = step.skippable ? " (optional)" : "";
  const header = `[Step ${stepNumber}/${total}] ${step.title}${tag}`;
  return `${header}\n${step.description}\n> ${step.action}`;
}

/** Render a simple text-based progress bar. */
export function formatProgressBar(progress: TutorialProgress): string {
  const total = TUTORIAL_STEPS.length;
  const done = progress.completedSteps.length;
  const barWidth = 20;
  const filled = Math.round((done / total) * barWidth);
  const empty = barWidth - filled;
  const bar = `[${"#".repeat(filled)}${"-".repeat(empty)}]`;
  return `${bar} ${done}/${total} steps completed (${getCompletionPercentage(progress)}%)`;
}

/** Check whether every tutorial step has been completed. */
export function isTutorialComplete(progress: TutorialProgress): boolean {
  return TUTORIAL_STEPS.every((s) => progress.completedSteps.includes(s.id));
}
