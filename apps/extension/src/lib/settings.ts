export interface ExtensionSettings {
  backendUrl: string;
  frontendUrl: string;
  meetDetectionEnabled: boolean;
  zoomDetectionEnabled: boolean;
  inPageBannerEnabled: boolean;
  autoStopEnabled: boolean;
  autoOpenResultEnabled: boolean;
}

export const DEFAULT_SETTINGS: ExtensionSettings = {
  backendUrl: "http://localhost:8000",
  frontendUrl: "http://localhost:3000",
  meetDetectionEnabled: true,
  zoomDetectionEnabled: true,
  inPageBannerEnabled: true,
  autoStopEnabled: true,
  autoOpenResultEnabled: true,
};

const STORAGE_KEY = "notDefteriSettings";

export interface UrlValidationResult {
  valid: boolean;
  error?: string;
}

/** Pure validation so the options page and tests don't need a real URL bar. */
export function validateUrl(value: string): UrlValidationResult {
  const trimmed = value.trim();
  if (!trimmed) return { valid: false, error: "Adres boş olamaz." };

  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    return { valid: false, error: "Geçersiz adres. Örnek: http://localhost:8000" };
  }

  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    return { valid: false, error: "Adres http:// veya https:// ile başlamalıdır." };
  }
  if (!parsed.hostname) {
    return { valid: false, error: "Adres bir sunucu adı içermelidir." };
  }
  return { valid: true };
}

/** Strips a trailing slash so URL concatenation elsewhere never produces a double slash. */
export function normalizeUrl(value: string): string {
  return value.trim().replace(/\/+$/, "");
}

export interface SettingsStorage {
  get(key: string): Promise<Record<string, unknown>>;
  set(items: Record<string, unknown>): Promise<void>;
}

function chromeSettingsStorage(): SettingsStorage {
  return {
    get: (key) => chrome.storage.sync.get(key),
    set: (items) => chrome.storage.sync.set(items),
  };
}

export async function loadSettings(storage: SettingsStorage = chromeSettingsStorage()): Promise<ExtensionSettings> {
  const result = await storage.get(STORAGE_KEY);
  const stored = result[STORAGE_KEY] as Partial<ExtensionSettings> | undefined;
  return { ...DEFAULT_SETTINGS, ...stored };
}

export async function saveSettings(
  settings: ExtensionSettings,
  storage: SettingsStorage = chromeSettingsStorage()
): Promise<void> {
  await storage.set({ [STORAGE_KEY]: settings });
}
