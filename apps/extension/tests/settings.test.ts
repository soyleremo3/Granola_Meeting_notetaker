import { describe, expect, it } from "vitest";
import {
  DEFAULT_SETTINGS,
  loadSettings,
  normalizeUrl,
  saveSettings,
  validateUrl,
  type ExtensionSettings,
  type SettingsStorage,
} from "../src/lib/settings";

function fakeStorage(initial: Record<string, unknown> = {}): SettingsStorage {
  const store = { ...initial };
  return {
    get: async (key: string) => ({ [key]: store[key] }),
    set: async (items: Record<string, unknown>) => {
      Object.assign(store, items);
    },
  };
}

describe("validateUrl (invalid settings URLs)", () => {
  it("accepts a plain http localhost URL", () => {
    expect(validateUrl("http://localhost:8000").valid).toBe(true);
  });

  it("accepts an https URL", () => {
    expect(validateUrl("https://example.com").valid).toBe(true);
  });

  it("rejects an empty value", () => {
    const result = validateUrl("   ");
    expect(result.valid).toBe(false);
    expect(result.error).toBeTruthy();
  });

  it("rejects a value that isn't a URL at all", () => {
    expect(validateUrl("not a url").valid).toBe(false);
  });

  it("rejects non-http(s) schemes", () => {
    expect(validateUrl("ftp://localhost:8000").valid).toBe(false);
    expect(validateUrl("javascript:alert(1)").valid).toBe(false);
  });
});

describe("normalizeUrl", () => {
  it("strips a trailing slash", () => {
    expect(normalizeUrl("http://localhost:8000/")).toBe("http://localhost:8000");
  });

  it("strips repeated trailing slashes and surrounding whitespace", () => {
    expect(normalizeUrl("  http://localhost:8000//  ")).toBe("http://localhost:8000");
  });

  it("leaves an already-clean URL untouched", () => {
    expect(normalizeUrl("http://localhost:8000")).toBe("http://localhost:8000");
  });
});

describe("loadSettings / saveSettings", () => {
  it("returns defaults when nothing has been saved yet", async () => {
    const settings = await loadSettings(fakeStorage());
    expect(settings).toEqual(DEFAULT_SETTINGS);
  });

  it("merges saved values over the defaults", async () => {
    const storage = fakeStorage();
    const partial: ExtensionSettings = { ...DEFAULT_SETTINGS, backendUrl: "http://localhost:9000" };
    await saveSettings(partial, storage);
    const loaded = await loadSettings(storage);
    expect(loaded.backendUrl).toBe("http://localhost:9000");
    expect(loaded.frontendUrl).toBe(DEFAULT_SETTINGS.frontendUrl);
  });
});
