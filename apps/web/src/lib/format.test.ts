import { describe, expect, it } from "vitest";
import { formatDuration, formatTimestamp } from "./format";

describe("formatDuration", () => {
  it("returns a dash for null", () => {
    expect(formatDuration(null)).toBe("—");
  });

  it("formats seconds only", () => {
    expect(formatDuration(45)).toBe("45 sn");
  });

  it("formats minutes and seconds", () => {
    expect(formatDuration(125)).toBe("2 dk 5 sn");
  });

  it("formats hours and minutes", () => {
    expect(formatDuration(3725)).toBe("1 sa 2 dk");
  });
});

describe("formatTimestamp", () => {
  it("formats sub-minute timestamps as mm:ss", () => {
    expect(formatTimestamp(5)).toBe("00:05");
  });

  it("formats minute-scale timestamps as mm:ss", () => {
    expect(formatTimestamp(125)).toBe("02:05");
  });

  it("formats hour-scale timestamps as h:mm:ss", () => {
    expect(formatTimestamp(3665)).toBe("1:01:05");
  });

  it("clamps negative input to zero", () => {
    expect(formatTimestamp(-5)).toBe("00:00");
  });
});
