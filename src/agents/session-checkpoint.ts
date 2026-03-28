import { randomUUID } from "node:crypto";

export interface Checkpoint {
  id: string;
  sessionId: string;
  turnNumber: number;
  timestamp: number;
  state: CheckpointState;
}

export interface CheckpointState {
  activeTasks: string[];
  recentDecisions: string[];
  toolsUsed: string[];
  openQuestions: string[];
  tokenCount: number;
  userPreferences: string[];
  summary: string;
}

export interface CheckpointManager {
  /** Create a checkpoint at the current state. */
  save(sessionId: string, turnNumber: number, state: CheckpointState): Checkpoint;
  /** Get the latest checkpoint for a session. */
  getLatest(sessionId: string): Checkpoint | null;
  /** Get a specific checkpoint by ID. */
  getById(checkpointId: string): Checkpoint | null;
  /** List all checkpoints for a session (newest first). */
  list(sessionId: string): Checkpoint[];
  /** Resume from a checkpoint — returns the state to bootstrap with. */
  resume(checkpointId: string): CheckpointState | null;
  /** Delete old checkpoints, keeping only the N most recent per session. */
  prune(sessionId: string, keepCount: number): number;
  /** Get total checkpoint count across all sessions. */
  totalCount(): number;
  /** Clear all checkpoints. */
  clear(): void;
  /** Format a checkpoint as a resume prompt. */
  formatResumePrompt(checkpoint: Checkpoint): string;
}

export interface CheckpointConfig {
  autoSaveInterval: number;
  maxCheckpointsPerSession: number;
}

const DEFAULT_CONFIG: CheckpointConfig = {
  autoSaveInterval: 50,
  maxCheckpointsPerSession: 10,
};

/** Check if a checkpoint should be auto-saved based on turn number. */
export function shouldAutoSave(turnNumber: number, interval: number): boolean {
  if (interval <= 0 || turnNumber <= 0) {
    return false;
  }
  return turnNumber % interval === 0;
}

/** Create an in-memory checkpoint manager. */
export function createCheckpointManager(config?: Partial<CheckpointConfig>): CheckpointManager {
  const resolved: CheckpointConfig = { ...DEFAULT_CONFIG, ...config };
  const store = new Map<string, Checkpoint[]>();
  // Secondary index for O(1) lookup by checkpoint ID.
  const byId = new Map<string, Checkpoint>();

  function getOrCreate(sessionId: string): Checkpoint[] {
    let list = store.get(sessionId);
    if (!list) {
      list = [];
      store.set(sessionId, list);
    }
    return list;
  }

  function autoPrune(sessionId: string): void {
    const list = store.get(sessionId);
    if (!list || list.length <= resolved.maxCheckpointsPerSession) {
      return;
    }
    // List is kept sorted newest-first; remove from the tail (oldest).
    const removed = list.splice(resolved.maxCheckpointsPerSession);
    for (const cp of removed) {
      byId.delete(cp.id);
    }
  }

  return {
    save(sessionId, turnNumber, state) {
      const checkpoint: Checkpoint = {
        id: randomUUID(),
        sessionId,
        turnNumber,
        timestamp: Date.now(),
        state,
      };
      const list = getOrCreate(sessionId);
      // Insert at the front so the list stays newest-first.
      list.unshift(checkpoint);
      byId.set(checkpoint.id, checkpoint);
      autoPrune(sessionId);
      return checkpoint;
    },

    getLatest(sessionId) {
      const list = store.get(sessionId);
      return list?.[0] ?? null;
    },

    getById(checkpointId) {
      return byId.get(checkpointId) ?? null;
    },

    list(sessionId) {
      return store.get(sessionId) ?? [];
    },

    resume(checkpointId) {
      const cp = byId.get(checkpointId);
      return cp?.state ?? null;
    },

    prune(sessionId, keepCount) {
      const list = store.get(sessionId);
      if (!list || list.length <= keepCount) {
        return 0;
      }
      const removed = list.splice(keepCount);
      for (const cp of removed) {
        byId.delete(cp.id);
      }
      return removed.length;
    },

    totalCount() {
      let count = 0;
      for (const list of store.values()) {
        count += list.length;
      }
      return count;
    },

    clear() {
      store.clear();
      byId.clear();
    },

    formatResumePrompt(checkpoint) {
      const { state, turnNumber } = checkpoint;
      const lines: string[] = [
        `[Session Resume - Checkpoint from turn #${turnNumber}]`,
        `Summary: ${state.summary}`,
      ];
      if (state.activeTasks.length > 0) {
        lines.push(`Active tasks: ${state.activeTasks.join(", ")}`);
      }
      if (state.recentDecisions.length > 0) {
        lines.push(`Recent decisions: ${state.recentDecisions.join(", ")}`);
      }
      if (state.openQuestions.length > 0) {
        lines.push(`Open questions: ${state.openQuestions.join(", ")}`);
      }
      if (state.toolsUsed.length > 0) {
        lines.push(`Tools used: ${state.toolsUsed.join(", ")}`);
      }
      if (state.userPreferences.length > 0) {
        lines.push(`User preferences: ${state.userPreferences.join(", ")}`);
      }
      lines.push(`Token count: ${state.tokenCount}`);
      return lines.join("\n");
    },
  };
}
