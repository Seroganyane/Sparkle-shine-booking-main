import { describe, expect, it } from "vitest";
import { idNumberError, isValidIdNumber, normalizeIdNumber } from "@/lib/idNumber";

describe("identity number validation", () => {
  it("accepts a well-formed South African ID number", () => {
    expect(idNumberError("8001015009087")).toBeNull();
    expect(isValidIdNumber("9202204720083")).toBe(true);
  });

  it("ignores spacing used when reading the number aloud", () => {
    expect(normalizeIdNumber("800101 5009 087")).toBe("8001015009087");
    expect(isValidIdNumber("800101 5009 087")).toBe(true);
  });

  it("rejects anything that is not thirteen digits", () => {
    expect(idNumberError("")).toMatch(/13 digits/);
    expect(idNumberError("80010150090")).toMatch(/13 digits/);
    expect(idNumberError("80010150090871")).toMatch(/13 digits/);
    expect(idNumberError("80010150090AB")).toMatch(/13 digits/);
  });

  it("rejects an impossible date of birth", () => {
    expect(idNumberError("8013015009083")).toMatch(/date of birth/);
    expect(idNumberError("9902305009088")).toMatch(/date of birth/);
  });

  it("rejects an unknown citizenship digit", () => {
    expect(idNumberError("8001015009285")).toMatch(/eleventh digit/);
  });

  it("rejects a number that fails the checksum", () => {
    expect(idNumberError("8001015009088")).toMatch(/not valid/);
  });
});
