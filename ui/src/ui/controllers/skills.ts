import type { GatewayBrowserClient } from "../gateway.ts";
import type { SkillStatusReport } from "../types.ts";

export type StoreSkillItem = {
  slug: string;
  displayName: string;
  summary: string;
  tags?: Record<string, string>;
  score?: number;
  owner?: string;
  downloads?: number;
  updatedAt?: number;
};

export type StoreSkillDetail = {
  slug: string;
  displayName: string;
  summary: string;
  version: string;
  changelog: string;
  license: string;
  downloads: number;
  stars: number;
  installs: number;
  os: string[];
  owner: { handle: string; displayName: string; image: string };
  createdAt: number;
  updatedAt: number;
};

export type SkillsState = {
  client: GatewayBrowserClient | null;
  connected: boolean;
  skillsLoading: boolean;
  skillsReport: SkillStatusReport | null;
  skillsError: string | null;
  skillsBusyKey: string | null;
  skillEdits: Record<string, string>;
  skillMessages: SkillMessageMap;
  skillsStoreItems: StoreSkillItem[];
  skillsStoreLoading: boolean;
  skillsStoreError: string | null;
  // Current text in the Skill Store search input. Controlled by
  // `handleStoreQueryChange`; read by the background paginator to
  // decide whether to fetch in turbo mode.
  skillsStoreQuery: string;
  // True once loadStoreSkills has completed at least once (success or error).
  // The render loop uses this to avoid re-triggering the fetch forever when
  // the store legitimately returns zero items.
  skillsStoreLoaded?: boolean;
  skillsStoreDetail: StoreSkillDetail | null;
  skillsStoreDetailLoading: boolean;
  // Cursor returned by the last browse-mode `skills.search` call. When
  // non-null, the background loader keeps fetching more pages in 100-item
  // batches so the Skill Store gradually fills up without blocking the
  // initial render.
  skillsStoreNextCursor?: string | null;
  // Pending `setTimeout` handle for the next background fetch. Cleared on
  // tab switch so we never leave a stray interval running against an
  // abandoned store view.
  skillsStoreBackgroundTimer?: ReturnType<typeof setTimeout> | null;
  // Debounce handle for the remote text search that fires as the user
  // types in the Skill Store search box. A new keystroke cancels the
  // pending call and schedules a fresh one so we hit ClawHub at most
  // once per pause in typing.
  skillsStoreSearchDebounceTimer?: ReturnType<typeof setTimeout> | null;
  // True while a remote text search is in flight. Used to surface a
  // subtle "searching…" hint in the UI without hiding the existing
  // browse results.
  skillsStoreSearching?: boolean;
  // The most recent query that actually hit the server. Tracked so a
  // repeated Enter press (or a duplicate debounce fire) doesn't replay
  // the same search needlessly.
  skillsStoreLastRemoteQuery?: string;
};

export type SkillMessage = {
  kind: "success" | "error";
  message: string;
};

export type SkillMessageMap = Record<string, SkillMessage>;

type LoadSkillsOptions = {
  clearMessages?: boolean;
};

function setSkillMessage(state: SkillsState, key: string, message?: SkillMessage) {
  if (!key.trim()) {
    return;
  }
  const next = { ...state.skillMessages };
  if (message) {
    next[key] = message;
  } else {
    delete next[key];
  }
  state.skillMessages = next;
}

function getErrorMessage(err: unknown) {
  if (err instanceof Error) {
    return err.message;
  }
  return String(err);
}

export async function loadSkills(state: SkillsState, options?: LoadSkillsOptions) {
  if (options?.clearMessages && Object.keys(state.skillMessages).length > 0) {
    state.skillMessages = {};
  }
  if (!state.client || !state.connected) {
    return;
  }
  if (state.skillsLoading) {
    return;
  }
  state.skillsLoading = true;
  state.skillsError = null;
  try {
    const res = await state.client.request<SkillStatusReport | undefined>("skills.status", {});
    if (res) {
      state.skillsReport = res;
    }
  } catch (err) {
    state.skillsError = getErrorMessage(err);
  } finally {
    state.skillsLoading = false;
  }
}

export function updateSkillEdit(state: SkillsState, skillKey: string, value: string) {
  state.skillEdits = { ...state.skillEdits, [skillKey]: value };
}

export async function updateSkillEnabled(state: SkillsState, skillKey: string, enabled: boolean) {
  if (!state.client || !state.connected) {
    return;
  }
  state.skillsBusyKey = skillKey;
  state.skillsError = null;
  try {
    await state.client.request("skills.update", { skillKey, enabled });
    await loadSkills(state);
    setSkillMessage(state, skillKey, {
      kind: "success",
      message: enabled ? "Skill enabled" : "Skill disabled",
    });
  } catch (err) {
    const message = getErrorMessage(err);
    state.skillsError = message;
    setSkillMessage(state, skillKey, {
      kind: "error",
      message,
    });
  } finally {
    state.skillsBusyKey = null;
  }
}

export async function saveSkillApiKey(state: SkillsState, skillKey: string) {
  if (!state.client || !state.connected) {
    return;
  }
  state.skillsBusyKey = skillKey;
  state.skillsError = null;
  try {
    const apiKey = state.skillEdits[skillKey] ?? "";
    await state.client.request("skills.update", { skillKey, apiKey });
    await loadSkills(state);
    setSkillMessage(state, skillKey, {
      kind: "success",
      message: `API key saved — stored in godseye.json (skills.entries.${skillKey})`,
    });
  } catch (err) {
    const message = getErrorMessage(err);
    state.skillsError = message;
    setSkillMessage(state, skillKey, {
      kind: "error",
      message,
    });
  } finally {
    state.skillsBusyKey = null;
  }
}

export async function installSkill(
  state: SkillsState,
  skillKey: string,
  name: string,
  installId: string,
) {
  if (!state.client || !state.connected) {
    return;
  }
  state.skillsBusyKey = skillKey;
  state.skillsError = null;
  try {
    const result = await state.client.request<{ message?: string }>("skills.install", {
      name,
      installId,
      timeoutMs: 120000,
    });
    await loadSkills(state);
    setSkillMessage(state, skillKey, {
      kind: "success",
      message: result?.message ?? "Installed",
    });
  } catch (err) {
    const message = getErrorMessage(err);
    state.skillsError = message;
    setSkillMessage(state, skillKey, {
      kind: "error",
      message,
    });
  } finally {
    state.skillsBusyKey = null;
  }
}

// Gateway returns `skills.search` results in this shape (see
// `src/infra/clawhub.ts#ClawHubSkillSearchResult`). Keep the field list in
// sync with that type; we map it to `StoreSkillItem` below.
type GatewaySkillSearchResult = {
  score?: number;
  slug: string;
  displayName: string;
  summary?: string;
  version?: string;
  updatedAt?: number;
};

// Throttle for the background paginator. ClawHub's /api/v1/packages is
// cursor-paginated at 100 items/page. We keep a modest gap between
// pages while the user is idly browsing (so we're polite to the
// registry) but drop to an aggressive cadence while the user has an
// active search query — that way a search for "ads" streams matches
// into the grid within a few seconds instead of waiting a minute per
// page for the /search endpoint to miss them.
const STORE_BACKGROUND_INTERVAL_IDLE_MS = 1_500;
const STORE_BACKGROUND_INTERVAL_TURBO_MS = 150;
// Upper bound on how many skills we retain in memory. The UI keeps
// appending background pages until we hit this. Anything past this is
// probably junk the user should find via search instead.
const STORE_MAX_ITEMS = 10_000;

function mapGatewayResult(item: GatewaySkillSearchResult): StoreSkillItem {
  return {
    slug: item.slug,
    displayName: item.displayName,
    summary: item.summary ?? "",
    score: item.score,
    updatedAt: item.updatedAt,
  };
}

function cancelStoreBackgroundTimer(state: SkillsState) {
  if (state.skillsStoreBackgroundTimer) {
    clearTimeout(state.skillsStoreBackgroundTimer);
    state.skillsStoreBackgroundTimer = null;
  }
}

function scheduleNextStorePage(state: SkillsState) {
  cancelStoreBackgroundTimer(state);
  if (!state.skillsStoreNextCursor || state.skillsStoreItems.length >= STORE_MAX_ITEMS) {
    return;
  }
  // Turbo cadence while the user has an active search query — we want
  // the full catalog to stream in as fast as possible so their search
  // results converge on parity with the ClawHub website. Fall back to
  // the polite idle cadence otherwise.
  const hasActiveQuery = Boolean(state.skillsStoreQuery.trim());
  const delay = hasActiveQuery
    ? STORE_BACKGROUND_INTERVAL_TURBO_MS
    : STORE_BACKGROUND_INTERVAL_IDLE_MS;
  state.skillsStoreBackgroundTimer = setTimeout(() => {
    void loadNextStorePage(state);
  }, delay);
}

async function loadNextStorePage(state: SkillsState): Promise<void> {
  if (
    !state.client ||
    !state.connected ||
    !state.skillsStoreNextCursor ||
    state.skillsStoreItems.length >= STORE_MAX_ITEMS
  ) {
    return;
  }
  try {
    const res = await state.client.request<{
      results: GatewaySkillSearchResult[];
      nextCursor?: string | null;
    }>("skills.search", {
      limit: 100,
      englishOnly: true,
      cursor: state.skillsStoreNextCursor,
    });
    const results = res?.results ?? [];
    // De-dupe by slug — the registry occasionally repeats entries on
    // adjacent pages and we don't want ghost rows in the grid.
    const seen = new Set(state.skillsStoreItems.map((item) => item.slug));
    const fresh = results.map(mapGatewayResult).filter((item) => !seen.has(item.slug));
    if (fresh.length > 0) {
      state.skillsStoreItems = [...state.skillsStoreItems, ...fresh];
    }
    state.skillsStoreNextCursor = res?.nextCursor ?? null;
  } catch {
    // Background failures are silent: a transient registry hiccup
    // shouldn't surface a red error banner while the user is browsing
    // skills they already have. We'll retry on the next tick.
  } finally {
    scheduleNextStorePage(state);
  }
}

// Gateway returns `skills.detail` as `ClawHubSkillDetail` (nested).
type GatewaySkillDetail = {
  skill: {
    slug: string;
    displayName: string;
    summary?: string;
    tags?: Record<string, string>;
    createdAt: number;
    updatedAt: number;
  } | null;
  latestVersion?: {
    version: string;
    createdAt: number;
    changelog?: string;
  } | null;
  metadata?: {
    os?: string[] | null;
    license?: string | null;
    downloads?: number | null;
    stars?: number | null;
    installs?: number | null;
    owner?: { handle?: string; displayName?: string; image?: string } | null;
  } | null;
};

/**
 * Kick off the initial browse-mode load for the Skill Store. Fetches the
 * first 100 English-filtered skills from ClawHub and then schedules a
 * background paginator (one page per minute) that appends the rest of
 * the catalog without blocking the UI.
 *
 * This function never wipes existing items or overlays a search — the
 * text search path goes through `searchStoreSkillsRemote` and merges
 * into the same list.
 */
export async function loadStoreSkills(state: SkillsState) {
  if (!state.client || !state.connected) {
    return;
  }
  if (state.skillsStoreLoading || state.skillsStoreLoaded) {
    return;
  }
  cancelStoreBackgroundTimer(state);
  state.skillsStoreItems = [];
  state.skillsStoreNextCursor = null;
  state.skillsStoreLoading = true;
  state.skillsStoreError = null;
  try {
    // The gateway exposes `skills.search`, not `skills.store.list`.
    // Older commits of this controller hit a non-existent method which
    // left the store stuck on "Loading store…" forever.
    const res = await state.client.request<{
      results: GatewaySkillSearchResult[];
      nextCursor?: string | null;
    }>("skills.search", { limit: 100, englishOnly: true });
    const results = res?.results ?? [];
    state.skillsStoreItems = results.map(mapGatewayResult);
    state.skillsStoreNextCursor = res?.nextCursor ?? null;
  } catch (err) {
    state.skillsStoreError = getErrorMessage(err);
  } finally {
    state.skillsStoreLoading = false;
    state.skillsStoreLoaded = true;
  }
  scheduleNextStorePage(state);
}

/**
 * Hit ClawHub's text-search endpoint for the current query and merge
 * any matches into the front of `skillsStoreItems`. Does *not* wipe the
 * existing browse stream, so once the server responds the user sees
 * server-matched skills first and the rest of the already-loaded
 * browse results below (the view's client-side text filter then
 * narrows the visible grid to whatever actually matches `storeQuery`).
 *
 * Background pagination keeps running in parallel so the full catalog
 * continues to stream in underneath.
 */
export async function searchStoreSkillsRemote(state: SkillsState): Promise<void> {
  if (!state.client || !state.connected) {
    return;
  }
  const query = state.skillsStoreQuery.trim();
  if (!query) {
    state.skillsStoreSearching = false;
    state.skillsStoreLastRemoteQuery = "";
    return;
  }
  // Skip duplicate searches (e.g. Enter pressed twice on the same term).
  if (state.skillsStoreLastRemoteQuery === query && state.skillsStoreSearching) {
    return;
  }
  state.skillsStoreSearching = true;
  try {
    const res = await state.client.request<{
      results: GatewaySkillSearchResult[];
      nextCursor?: string | null;
    }>("skills.search", { query, limit: 100, englishOnly: true });
    // If the user edited the query while this request was in flight,
    // discard the stale response — a newer debounced call is already
    // on its way and will reconcile.
    if (state.skillsStoreQuery.trim() !== query) {
      return;
    }
    const results = res?.results ?? [];
    const mapped = results.map(mapGatewayResult);
    if (mapped.length > 0) {
      // Prepend server matches, then append whatever we already had,
      // dropping duplicates by slug so a skill that was already in the
      // browse stream rises to the top instead of appearing twice.
      const seen = new Set<string>();
      const merged: StoreSkillItem[] = [];
      for (const item of mapped) {
        if (seen.has(item.slug)) {
          continue;
        }
        seen.add(item.slug);
        merged.push(item);
      }
      for (const item of state.skillsStoreItems) {
        if (seen.has(item.slug)) {
          continue;
        }
        seen.add(item.slug);
        merged.push(item);
      }
      state.skillsStoreItems = merged;
    }
    state.skillsStoreLastRemoteQuery = query;
  } catch {
    // Silent — the client-side filter over already-loaded items is
    // still responsive, so a transient ClawHub outage shouldn't paint
    // a scary error banner mid-type.
  } finally {
    if (state.skillsStoreQuery.trim() === query) {
      state.skillsStoreSearching = false;
    }
  }
}

// Debounce window for the auto-search that fires as the user types in
// the Skill Store search box. Short enough to feel live, long enough
// that every keystroke doesn't hit ClawHub.
const STORE_SEARCH_DEBOUNCE_MS = 350;

/**
 * Called on every keystroke in the Skill Store search input. Updates
 * the bound query immediately so the client-side filter in the view
 * reacts live, then schedules a debounced remote search that will
 * merge ClawHub-wide matches in when it returns.
 */
export function handleStoreQueryChange(state: SkillsState, next: string) {
  const previous = state.skillsStoreQuery;
  state.skillsStoreQuery = next;
  if (state.skillsStoreSearchDebounceTimer) {
    clearTimeout(state.skillsStoreSearchDebounceTimer);
    state.skillsStoreSearchDebounceTimer = null;
  }
  // Reschedule the background paginator so a newly-active query
  // flips it into turbo cadence immediately instead of waiting out
  // the 1.5s idle timer that was armed before the user started
  // typing. Same deal in reverse when the query is cleared.
  const wasActive = previous.trim().length > 0;
  const isActive = next.trim().length > 0;
  if (wasActive !== isActive && state.skillsStoreNextCursor) {
    scheduleNextStorePage(state);
  }
  if (!isActive) {
    // Query cleared — cancel any in-flight search spinner and let the
    // existing browse list show through again.
    state.skillsStoreSearching = false;
    state.skillsStoreLastRemoteQuery = "";
    return;
  }
  state.skillsStoreSearchDebounceTimer = setTimeout(() => {
    state.skillsStoreSearchDebounceTimer = null;
    void searchStoreSkillsRemote(state);
  }, STORE_SEARCH_DEBOUNCE_MS);
}

/**
 * Triggered by the Enter keypress on the search input. Cancels any
 * pending debounce and fires the remote search immediately.
 */
export function submitStoreSearch(state: SkillsState) {
  if (state.skillsStoreSearchDebounceTimer) {
    clearTimeout(state.skillsStoreSearchDebounceTimer);
    state.skillsStoreSearchDebounceTimer = null;
  }
  void searchStoreSkillsRemote(state);
}

/**
 * Stop the Skill Store background paginator. Called when leaving the
 * Skills tab so we don't keep issuing registry requests in the back-
 * ground while the user is somewhere else in the app.
 */
export function stopStoreBackgroundLoader(state: SkillsState) {
  cancelStoreBackgroundTimer(state);
  if (state.skillsStoreSearchDebounceTimer) {
    clearTimeout(state.skillsStoreSearchDebounceTimer);
    state.skillsStoreSearchDebounceTimer = null;
  }
}

export async function loadStoreSkillDetail(state: SkillsState, slug: string) {
  if (!state.client || !state.connected) {
    return;
  }
  state.skillsStoreDetailLoading = true;
  state.skillsStoreDetail = null;
  try {
    const res = await state.client.request<GatewaySkillDetail>("skills.detail", { slug });
    if (!res?.skill) {
      state.skillsStoreDetail = null;
      return;
    }
    const meta = res.metadata ?? null;
    const latest = res.latestVersion ?? null;
    state.skillsStoreDetail = {
      slug: res.skill.slug,
      displayName: res.skill.displayName,
      summary: res.skill.summary ?? "",
      version: latest?.version ?? "",
      changelog: latest?.changelog ?? "",
      license: meta?.license ?? "",
      downloads: meta?.downloads ?? 0,
      stars: meta?.stars ?? 0,
      installs: meta?.installs ?? 0,
      os: meta?.os ?? [],
      owner: {
        handle: meta?.owner?.handle ?? "",
        displayName: meta?.owner?.displayName ?? "",
        image: meta?.owner?.image ?? "",
      },
      createdAt: res.skill.createdAt,
      updatedAt: res.skill.updatedAt,
    };
  } catch {
    state.skillsStoreDetail = null;
  } finally {
    state.skillsStoreDetailLoading = false;
  }
}

export async function installStoreSkill(state: SkillsState, slug: string) {
  if (!state.client || !state.connected) {
    return;
  }
  state.skillsBusyKey = slug;
  try {
    await state.client.request("skills.install", {
      source: "clawhub",
      slug,
    });
    await loadSkills(state);
    setSkillMessage(state, slug, {
      kind: "success",
      message: `Installed ${slug} from store`,
    });
  } catch (err) {
    setSkillMessage(state, slug, {
      kind: "error",
      message: getErrorMessage(err),
    });
  } finally {
    state.skillsBusyKey = null;
  }
}
