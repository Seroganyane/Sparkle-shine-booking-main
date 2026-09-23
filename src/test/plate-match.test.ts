import { describe, expect, it } from "vitest";
import { plateTextMatches } from "@/lib/plateMatch";

describe("plate scan matching", () => {
  it("matches a plate that is its own clean OCR line", () => {
    expect(plateTextMatches("LDF821", "LDF821")).toBe(true);
    expect(plateTextMatches("LDF 821", "LDF821")).toBe(true);
  });

  // Regression: a real photo of a correct, clearly-legible plate ("LDF 821")
  // was rejected as a mismatch because the dealer badge printed below the
  // plate ("NTT TOYOTA WHITE RIVER 087 286 2...") landed on its own OCR
  // line, and the old check required one whole line to equal the plate
  // exactly — no single line qualified even though the plate was correct.
  it("matches when the plate shares the scan with other printed text", () => {
    const scan = "UNP 2024\nLDF 821\nNTT TOYOTA WHITE RIVER 087 286 2";
    expect(plateTextMatches(scan, "LDF821")).toBe(true);
  });

  it("matches when unrelated text lands on the same line as the plate", () => {
    expect(plateTextMatches("LDF821UNP2024", "LDF821")).toBe(true);
  });

  it("tolerates the common O/0 and I/1 OCR mix-up", () => {
    expect(plateTextMatches("LDF82I", "LDF821")).toBe(true); // OCR read "1" as letter I
    expect(plateTextMatches("LD082I", "LDO821")).toBe(true); // booking plate itself has a letter O
  });

  it("rejects a genuinely different plate", () => {
    expect(plateTextMatches("ABC123", "LDF821")).toBe(false);
  });

  it("rejects unreadable or empty scans", () => {
    expect(plateTextMatches("", "LDF821")).toBe(false);
    expect(plateTextMatches("   \n  ", "LDF821")).toBe(false);
  });

  it("never matches an empty expected plate", () => {
    expect(plateTextMatches("LDF821", "")).toBe(false);
  });
});
