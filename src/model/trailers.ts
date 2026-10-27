// Trailer types and their typical starting values. Every value here is an
// example: the presets mark them as placeholders until the user replaces them.

import type { CaravanSpec, TrailerKind } from './types';

export interface TrailerKindInfo {
  kind: TrailerKind;
  /** Shown in the trailer type picker. */
  label: string;
  /** Used in running text and check labels, e.g. "boat trailer mass vs ATM". */
  noun: string;
  description: string;
}

export const TRAILER_KINDS: TrailerKindInfo[] = [
  { kind: 'caravan', label: 'Caravan', noun: 'caravan', description: 'Tandem 6 m caravan' },
  { kind: 'boat', label: 'Boat & trailer', noun: 'boat trailer', description: '5.3 m runabout on a single-axle trailer' },
  { kind: 'enclosed', label: 'Enclosed trailer', noun: 'trailer', description: '8×5 enclosed tandem trailer' },
  { kind: 'open', label: 'Open trailer', noun: 'trailer', description: '7×5 box trailer with low sides, unbraked' },
];

export function trailerInfo(kind: TrailerKind): TrailerKindInfo {
  return TRAILER_KINDS.find((k) => k.kind === kind) ?? TRAILER_KINDS[0];
}

/** "caravan", "boat trailer" or "trailer"; `capital` for the start of a sentence. */
export function trailerName(kind: TrailerKind, capital = false): string {
  const noun = trailerInfo(kind).noun;
  return capital ? noun[0].toUpperCase() + noun.slice(1) : noun;
}

// Small-trailer tyre: 185/80R14 (652 mm), load index 102 = 850 kg.
const SMALL_TYRE = { size: '185/80R14', loadIndex: 102 };

export function trailerPreset(kind: TrailerKind): CaravanSpec {
  switch (kind) {
    case 'caravan':
      return {
        kind,
        name: 'Tandem caravan',
        hasBrakes: true,
        axles: [4800, 5800],
        track: 1900,
        bodyStart: 1500,
        bodyLength: 6000,
        bodyWidth: 2400,
        bodyHeight: 2050,
        floorHeight: 760,
        tyre: { size: '235/75R15', loadIndex: 109 },
        limits: { atm: 3000, gtm: 2800, tare: 2350, tareBall: 230, axleRating: 1600 },
      };
    case 'boat':
      // "Body" is the bunk frame from the winch post back; the floor height is the bunk tops.
      return {
        kind,
        name: 'Boat trailer',
        hasBrakes: true,
        axles: [5000],
        track: 1750,
        bodyStart: 800,
        bodyLength: 5800,
        bodyWidth: 1900,
        bodyHeight: 900,
        floorHeight: 650,
        tyre: { ...SMALL_TYRE },
        limits: { atm: 1400, gtm: 1300, tare: 380, tareBall: 35, axleRating: 1400 },
      };
    case 'enclosed':
      return {
        kind,
        name: 'Enclosed trailer',
        hasBrakes: true,
        axles: [2300, 3100],
        track: 1820,
        bodyStart: 1200,
        bodyLength: 2440,
        bodyWidth: 1520,
        bodyHeight: 1600,
        floorHeight: 620,
        tyre: { ...SMALL_TYRE },
        limits: { atm: 2000, gtm: 1850, tare: 750, tareBall: 90, axleRating: 1000 },
      };
    case 'open':
      return {
        kind,
        name: 'Box trailer',
        hasBrakes: false,
        axles: [2380],
        track: 1800,
        bodyStart: 1100,
        bodyLength: 2130,
        bodyWidth: 1520,
        bodyHeight: 400,
        floorHeight: 620,
        tyre: { ...SMALL_TYRE },
        limits: { atm: 750, gtm: 700, tare: 320, tareBall: 35, axleRating: 1000 },
      };
  }
}

/** Setup paths of every preset trailer value, all unverified examples. */
export function trailerPlaceholders(spec: CaravanSpec): string[] {
  return [
    ...spec.axles.map((_, i) => `caravan.axles.${i}`),
    'caravan.track',
    'caravan.bodyStart',
    'caravan.bodyLength',
    'caravan.bodyWidth',
    'caravan.bodyHeight',
    'caravan.floorHeight',
    'caravan.tyre.size',
    'caravan.tyre.loadIndex',
    'caravan.limits.atm',
    'caravan.limits.gtm',
    'caravan.limits.tare',
    'caravan.limits.tareBall',
    'caravan.limits.axleRating',
  ];
}
