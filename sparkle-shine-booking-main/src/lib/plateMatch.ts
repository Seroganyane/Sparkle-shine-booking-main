// Matches an OCR-scanned vehicle photo's text against the plate a booking
// expects. Kept deliberately forgiving about *where* the plate characters
// appear in the scan (a dealer badge or a provincial sticker often ends up
// as its own OCR "line" right next to the plate) but strict about the
// characters themselves — this only ever confirms a plate that's genuinely
// there, never invents a match.
export const stripPlate = (value: string) => value.replace(/[^a-z0-9]/gi, "").toUpperCase();

// O/0 and I/1 are the most common OCR mix-ups on plate fonts, especially
// with a decorative sticker or badge overlapping the characters.
const foldOcrConfusion = (value: string) => value.replace(/O/g, "0").replace(/I/g, "1");

/**
 * Returns true if `expectedPlate` appears as a contiguous run of characters
 * anywhere within `scannedText` (not just as a whole line on its own —
 * requiring that rejected genuinely correct scans whenever the photo also
 * picked up nearby text, e.g. a dealer badge below the plate).
 */
export function plateTextMatches(scannedText: string, expectedPlate: string): boolean {
  const expected = stripPlate(expectedPlate);
  if (!expected) return false;
  const scanned = stripPlate(scannedText);
  if (scanned.includes(expected)) return true;
  return foldOcrConfusion(scanned).includes(foldOcrConfusion(expected));
}
