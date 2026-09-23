// South African identity numbers are 13 digits: YYMMDD (birth date), SSSS (gender
// sequence), C (citizenship), A, and a final Luhn check digit.
export const ID_NUMBER_LENGTH = 13;

export const normalizeIdNumber = (value: string) => value.replace(/\s/g, "");

const passesLuhn = (digits: string) => {
  let sum = 0;
  for (let offset = 0; offset < digits.length; offset++) {
    let digit = Number(digits[digits.length - 1 - offset]);
    if (offset % 2 === 1) {
      digit *= 2;
      if (digit > 9) digit -= 9;
    }
    sum += digit;
  }
  return sum % 10 === 0;
};

// The two-digit year is ambiguous, so the date only has to be real in one of the
// two possible centuries, and it may not be in the future.
const isRealBirthDate = (yy: string, mm: string, dd: string) => {
  const month = Number(mm);
  const day = Number(dd);
  if (month < 1 || month > 12 || day < 1 || day > 31) return false;
  return [1900, 2000].some((century) => {
    const date = new Date(Date.UTC(century + Number(yy), month - 1, day));
    return date.getUTCMonth() === month - 1 && date.getUTCDate() === day && date.getTime() <= Date.now();
  });
};

/** Returns null for a valid identity number, otherwise the message to show. */
export function idNumberError(value: string): string | null {
  const idNumber = normalizeIdNumber(value);
  if (!/^\d{13}$/.test(idNumber)) return "Identity number must be exactly 13 digits.";
  if (!isRealBirthDate(idNumber.slice(0, 2), idNumber.slice(2, 4), idNumber.slice(4, 6))) {
    return "The first six digits must be a date of birth (YYMMDD).";
  }
  if (idNumber[10] !== "0" && idNumber[10] !== "1") {
    return "The eleventh digit must be 0 (citizen) or 1 (permanent resident).";
  }
  if (!passesLuhn(idNumber)) return "This identity number is not valid — please check it for typos.";
  return null;
}

export const isValidIdNumber = (value: string) => idNumberError(value) === null;
