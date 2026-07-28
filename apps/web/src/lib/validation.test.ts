import { describe, expect, it } from "vitest";
import { validateMediaFile } from "./validation";

describe("validateMediaFile", () => {
  it("accepts a supported extension within the size limit", () => {
    const result = validateMediaFile({ name: "meeting.mp3", size: 1024 });
    expect(result.ok).toBe(true);
  });

  it("rejects an unsupported extension", () => {
    const result = validateMediaFile({ name: "meeting.exe", size: 1024 });
    expect(result.ok).toBe(false);
    expect(result.error).toContain("Desteklenmeyen dosya türü");
  });

  it("rejects an empty file", () => {
    const result = validateMediaFile({ name: "meeting.wav", size: 0 });
    expect(result.ok).toBe(false);
    expect(result.error).toContain("boş");
  });

  it("rejects a file over a configured size limit", () => {
    const result = validateMediaFile({ name: "meeting.mp4", size: 10 * 1024 * 1024 }, 5);
    expect(result.ok).toBe(false);
    expect(result.error).toContain("Maksimum boyut: 5 MB");
  });

  it("is case-insensitive for extensions", () => {
    const result = validateMediaFile({ name: "MEETING.MP3", size: 1024 });
    expect(result.ok).toBe(true);
  });

  it("accepts a very large file when no limit is configured (maxSizeMb = 0)", () => {
    const result = validateMediaFile({ name: "meeting.mp4", size: 20 * 1024 * 1024 * 1024 }, 0);
    expect(result.ok).toBe(true);
  });

  it("defaults to unlimited when no maxSizeMb argument is given", () => {
    const result = validateMediaFile({ name: "meeting.mp4", size: 5 * 1024 * 1024 * 1024 });
    expect(result.ok).toBe(true);
  });

  it("still enforces a configured limit when one is set above zero", () => {
    const result = validateMediaFile({ name: "meeting.mp4", size: 3 * 1024 * 1024 }, 5);
    expect(result.ok).toBe(true);
  });
});
