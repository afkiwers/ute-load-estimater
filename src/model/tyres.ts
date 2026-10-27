// ISO / ETRTO load index table (single fitment), kg per tyre.
const LOAD_INDEX: Record<number, number> = {
  70: 335, 71: 345, 72: 355, 73: 365, 74: 375, 75: 387, 76: 400, 77: 412, 78: 425, 79: 437,
  80: 450, 81: 462, 82: 475, 83: 487, 84: 500, 85: 515, 86: 530, 87: 545, 88: 560, 89: 580,
  90: 600, 91: 615, 92: 630, 93: 650, 94: 670, 95: 690, 96: 710, 97: 730, 98: 750, 99: 775,
  100: 800, 101: 825, 102: 850, 103: 875, 104: 900, 105: 925, 106: 950, 107: 975, 108: 1000, 109: 1030,
  110: 1060, 111: 1090, 112: 1120, 113: 1150, 114: 1180, 115: 1215, 116: 1250, 117: 1285, 118: 1320, 119: 1360,
  120: 1400, 121: 1450, 122: 1500, 123: 1550, 124: 1600, 125: 1650, 126: 1700, 127: 1750, 128: 1800, 129: 1850,
  130: 1900,
};

export const LOAD_INDEX_MIN = 70;
export const LOAD_INDEX_MAX = 130;

export function loadIndexKg(li: number | null | undefined): number | null {
  if (li == null) return null;
  return LOAD_INDEX[Math.round(li)] ?? null;
}

/**
 * Overall diameter in mm from a metric size such as "265/55R19" or
 * "LT265/75R16". Flotation sizes like "33x12.5R15" are read as inches.
 */
export function tyreDiameter(size: string): number | null {
  const metric = /(\d{3})\s*\/\s*(\d{2})\s*[A-Z]*\s*R?\s*(\d{2}(?:\.\d)?)/i.exec(size);
  if (metric) {
    const width = Number(metric[1]);
    const aspect = Number(metric[2]);
    const rim = Number(metric[3]);
    return Math.round(rim * 25.4 + 2 * width * (aspect / 100));
  }
  const flotation = /(\d{2}(?:\.\d+)?)\s*x\s*(\d{1,2}(?:\.\d+)?)\s*R?\s*(\d{2})/i.exec(size);
  if (flotation) return Math.round(Number(flotation[1]) * 25.4);
  return null;
}

export function tyreWidth(size: string): number | null {
  const metric = /(\d{3})\s*\//.exec(size);
  if (metric) return Number(metric[1]);
  const flotation = /x\s*(\d{1,2}(?:\.\d+)?)/i.exec(size);
  if (flotation) return Math.round(Number(flotation[1]) * 25.4);
  return null;
}
