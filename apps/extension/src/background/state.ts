import type { StateSnapshot } from "../lib/messages";

const STORAGE_KEY = "notDefteriState";

export const DEFAULT_STATE: StateSnapshot = {
  platform: null,
  tabId: null,
  phase: "idle",
  recordingStartedAt: null,
  meetingId: null,
  errorMessage: null,
  stageLabel: null,
};

/**
 * Backed by chrome.storage.session (in-memory, cleared on browser restart) rather than a module
 * variable: the MV3 service worker can be killed and restarted between events at any time, and a
 * plain `let state = ...` would silently reset mid-recording every time that happens.
 */
export async function getState(): Promise<StateSnapshot> {
  const result = await chrome.storage.session.get(STORAGE_KEY);
  const stored = result[STORAGE_KEY] as Partial<StateSnapshot> | undefined;
  return { ...DEFAULT_STATE, ...stored };
}

export async function setState(patch: Partial<StateSnapshot>): Promise<StateSnapshot> {
  const current = await getState();
  const next: StateSnapshot = { ...current, ...patch };
  await chrome.storage.session.set({ [STORAGE_KEY]: next });
  return next;
}

export async function resetState(): Promise<StateSnapshot> {
  await chrome.storage.session.set({ [STORAGE_KEY]: DEFAULT_STATE });
  return DEFAULT_STATE;
}
