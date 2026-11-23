/**
 * Repairs supplier strings that were stored as UTF-8 misread as Windows-1252,
 * including double-encoded strings (e.g. HahnemÃƒÂ¼hle). Does not touch
 * correctly decoded German text.
 */
const win1252: Record<number, number> = {
  0x20ac: 0x80, 0x201a: 0x82, 0x0192: 0x83, 0x201e: 0x84,
  0x2026: 0x85, 0x2020: 0x86, 0x2021: 0x87, 0x02c6: 0x88,
  0x2030: 0x89, 0x0160: 0x8a, 0x2039: 0x8b, 0x0152: 0x8c,
  0x017d: 0x8e, 0x2018: 0x91, 0x2019: 0x92, 0x201c: 0x93,
  0x201d: 0x94, 0x2022: 0x95, 0x2013: 0x96, 0x2014: 0x97,
  0x02dc: 0x98, 0x2122: 0x99, 0x0161: 0x9a, 0x203a: 0x9b,
  0x0153: 0x9c, 0x017e: 0x9e, 0x0178: 0x9f,
};

function decodeOne(value: string): string {
  const bytes: number[] = [];
  for (const char of value) {
    const cp = char.codePointAt(0)!;
    const byte = cp <= 255 ? cp : win1252[cp];
    if (byte === undefined) return value;
    bytes.push(byte);
  }
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(new Uint8Array(bytes));
  } catch {
    return value;
  }
}

export function printText(value: string | null | undefined): string {
  let result = value ?? '';
  for (let i = 0; i < 3 && /[ÃÂâ]/.test(result); i++) {
    const fixed = decodeOne(result);
    if (fixed === result || fixed.includes('\uFFFD')) break;
    result = fixed;
  }
  return result;
}

export function printDimension(widthMm: number | null, heightMm: number | null): string | null {
  if (!widthMm || !heightMm || widthMm <= 0 || heightMm <= 0) return null;
  const fmt = (n: number) => new Intl.NumberFormat('en-GB', { maximumFractionDigits: 1 }).format(n / 10);
  return `${fmt(widthMm)} × ${fmt(heightMm)} cm`;
}
