// GWM Cannon and Cannon Alpha dual-cab utes with the factory tub, as sold in Australia.
// Kerb weight, GVM, GCM, payload and towing are the published figures for each variant
// (CarExpert, carsales, Drive, CarsGuide and 4X4 Australia spec listings, October 2026).
// Paths in a model's placeholders hold typical values instead, to check against the
// vehicle's placard: axle limits and tub sizes are rarely published, and some older
// figures differ between sources.

import type { UteLimits, UteSpec } from './types';

export type VehicleFamily = 'GWM Cannon Alpha' | 'GWM Cannon';

export interface VehicleModel {
  id: string;
  family: VehicleFamily;
  /** Model, grade, engine and years, as listed in the picker. */
  label: string;
  spec: () => Omit<UteSpec, 'paint'>;
  /** Setup paths under "ute." holding typical rather than published values. */
  placeholders: string[];
}

export const DEFAULT_VEHICLE = 'alpha-vanta-30d';

/** Not published per variant, so always typical values. */
const ALWAYS_TYPICAL = [
  'ute.trackFront',
  'ute.trackRear',
  'ute.frontOverhang',
  'ute.tub.length',
  'ute.tub.width',
  'ute.tub.depth',
  'ute.tub.floorHeight',
  'ute.limits.frontAxle',
  'ute.limits.rearAxle',
  'ute.kerbFrontPct',
];

type Body = Pick<UteSpec, 'wheelbase' | 'trackFront' | 'trackRear' | 'overallLength' | 'overallWidth' | 'overallHeight' | 'frontOverhang' | 'tub' | 'kerbFrontPct'>;

const ALPHA: Body = {
  wheelbase: 3350,
  trackFront: 1635,
  trackRear: 1635,
  overallLength: 5445,
  overallWidth: 1991,
  overallHeight: 1924,
  frontOverhang: 950,
  tub: { length: 1485, width: 1520, depth: 540, floorHeight: 880 },
  kerbFrontPct: 56,
};

const CANNON: Body = {
  wheelbase: 3230,
  trackFront: 1600,
  trackRear: 1600,
  overallLength: 5416,
  overallWidth: 1947,
  overallHeight: 1884,
  frontOverhang: 920,
  tub: { length: 1520, width: 1520, depth: 540, floorHeight: 860 },
  kerbFrontPct: 56,
};

type Weights = Omit<UteLimits, 'frontAxle' | 'rearAxle' | 'tare'>;

interface Def {
  id: string;
  family: VehicleFamily;
  name: string;
  /** Model years in Australia. */
  years: string;
  body: Body;
  weights: Weights;
  /** Typical axle limits; never published. */
  axles: [front: number, rear: number];
  /** Typical tare (kerb weight less the usual fuel and fluids allowance) unless tarePublished. */
  tare: number;
  tarePublished?: true;
  tyre: { size: string; loadIndex: number };
  /** Paths whose values here are typical, on top of ALWAYS_TYPICAL. */
  typical: string[];
}

const DEFS: Def[] = [
  {
    id: 'alpha-vanta-30d',
    family: 'GWM Cannon Alpha',
    name: 'GWM Cannon Alpha Vanta 3.0L diesel',
    years: '2026–',
    body: ALPHA,
    weights: { kerb: 2550, gvm: 3495, gcm: 6555, payload: 945, brakedTow: 3500, unbrakedTow: 750, towBallMax: 350 },
    axles: [1600, 2100],
    tare: 2432,
    tyre: { size: '265/55R19', loadIndex: 109 },
    typical: ['ute.tyre.size', 'ute.tyre.loadIndex'],
  },
  {
    id: 'alpha-lux-30d',
    family: 'GWM Cannon Alpha',
    name: 'GWM Cannon Alpha Lux 3.0L diesel',
    years: '2026–',
    body: ALPHA,
    weights: { kerb: 2550, gvm: 3495, gcm: 6555, payload: 945, brakedTow: 3500, unbrakedTow: 750, towBallMax: 350 },
    axles: [1600, 2100],
    tare: 2432,
    tyre: { size: '265/60R18', loadIndex: 110 },
    typical: ['ute.tyre.loadIndex'],
  },
  {
    id: 'alpha-ultra-phev',
    family: 'GWM Cannon Alpha',
    name: 'GWM Cannon Alpha Ultra Hi4-T PHEV',
    years: '2025–',
    body: ALPHA,
    weights: { kerb: 2810, gvm: 3495, gcm: 6745, payload: 685, brakedTow: 3500, unbrakedTow: 750, towBallMax: 350 },
    axles: [1600, 2100],
    tare: 2692,
    tyre: { size: '265/60R18', loadIndex: 110 },
    typical: ['ute.tyre.loadIndex'],
  },
  {
    id: 'alpha-ultra-24d',
    family: 'GWM Cannon Alpha',
    name: 'GWM Cannon Alpha Ultra 2.4L diesel',
    years: '2024–2026',
    body: ALPHA,
    weights: { kerb: 2550, gvm: 3310, gcm: 6555, payload: 760, brakedTow: 3500, unbrakedTow: 750, towBallMax: 350 },
    axles: [1600, 2000],
    tare: 2432,
    tyre: { size: '265/60R18', loadIndex: 110 },
    typical: ['ute.tyre.loadIndex'],
  },
  {
    id: 'alpha-lux-24d',
    family: 'GWM Cannon Alpha',
    name: 'GWM Cannon Alpha Lux 2.4L diesel',
    years: '2024–2026',
    body: ALPHA,
    weights: { kerb: 2489, gvm: 3310, gcm: 6555, payload: 821, brakedTow: 3500, unbrakedTow: 750, towBallMax: 350 },
    axles: [1600, 2000],
    tare: 2371,
    tyre: { size: '265/60R18', loadIndex: 110 },
    typical: ['ute.tyre.loadIndex'],
  },
  {
    id: 'alpha-ultra-hybrid',
    family: 'GWM Cannon Alpha',
    name: 'GWM Cannon Alpha Ultra Hybrid 2.0L petrol',
    years: '2024–2025',
    body: ALPHA,
    weights: { kerb: 2575, gvm: 3310, gcm: 6555, payload: 735, brakedTow: 3500, unbrakedTow: 750, towBallMax: 350 },
    axles: [1600, 2000],
    tare: 2457,
    tyre: { size: '265/60R18', loadIndex: 110 },
    typical: ['ute.tyre.size', 'ute.tyre.loadIndex', 'ute.limits.towBallMax'],
  },
  {
    id: 'cannon-xsr-24d',
    family: 'GWM Cannon',
    name: 'GWM Cannon XSR 2.4L diesel',
    years: '2025–',
    body: { ...CANNON, overallLength: 5439, overallHeight: 1893 },
    weights: { kerb: 2330, gvm: 3205, gcm: 6300, payload: 875, brakedTow: 3500, unbrakedTow: 750, towBallMax: 350 },
    axles: [1500, 2000],
    tare: 2273,
    tarePublished: true,
    tyre: { size: '265/60R18', loadIndex: 110 },
    typical: ['ute.tyre.loadIndex'],
  },
  {
    id: 'cannon-vanta-24d',
    family: 'GWM Cannon',
    name: 'GWM Cannon Vanta 2.4L diesel',
    years: '2025–',
    body: CANNON,
    weights: { kerb: 2230, gvm: 3225, gcm: 6200, payload: 995, brakedTow: 3500, unbrakedTow: 750, towBallMax: 350 },
    axles: [1500, 2000],
    tare: 2173,
    tyre: { size: '265/60R18', loadIndex: 110 },
    typical: ['ute.tyre.size', 'ute.tyre.loadIndex'],
  },
  {
    id: 'cannon-ultra-24d',
    family: 'GWM Cannon',
    name: 'GWM Cannon Ultra 2.4L diesel',
    years: '2025–',
    body: CANNON,
    weights: { kerb: 2230, gvm: 3225, gcm: 6200, payload: 995, brakedTow: 3500, unbrakedTow: 750, towBallMax: 350 },
    axles: [1500, 2000],
    tare: 2173,
    tyre: { size: '265/60R18', loadIndex: 110 },
    typical: ['ute.tyre.size', 'ute.tyre.loadIndex'],
  },
  {
    id: 'cannon-lux-24d',
    family: 'GWM Cannon',
    name: 'GWM Cannon Lux 2.4L diesel',
    years: '2025–',
    body: CANNON,
    weights: { kerb: 2230, gvm: 3225, gcm: 6200, payload: 995, brakedTow: 3500, unbrakedTow: 750, towBallMax: 350 },
    axles: [1500, 2000],
    tare: 2173,
    tyre: { size: '265/60R18', loadIndex: 110 },
    typical: ['ute.tyre.size', 'ute.tyre.loadIndex'],
  },
  {
    id: 'cannon-vanta-20d',
    family: 'GWM Cannon',
    name: 'GWM Cannon Vanta 2.0L diesel',
    years: '2023–2024',
    body: CANNON,
    weights: { kerb: 2100, gvm: 3150, gcm: 5545, payload: 1050, brakedTow: 3000, unbrakedTow: 750, towBallMax: 300 },
    axles: [1450, 1950],
    tare: 2025,
    tarePublished: true,
    tyre: { size: '265/60R18', loadIndex: 110 },
    typical: ['ute.tyre.loadIndex', 'ute.overallLength', 'ute.overallWidth', 'ute.overallHeight'],
  },
  {
    id: 'cannon-x-20d',
    family: 'GWM Cannon',
    name: 'GWM Cannon-X 2.0L diesel',
    years: '2021–2024',
    body: CANNON,
    weights: { kerb: 2100, gvm: 3150, gcm: 5545, payload: 1050, brakedTow: 3000, unbrakedTow: 750, towBallMax: 300 },
    axles: [1450, 1950],
    tare: 2025,
    tyre: { size: '265/65R17', loadIndex: 112 },
    typical: ['ute.tyre.size', 'ute.tyre.loadIndex', 'ute.limits.gcm', 'ute.limits.towBallMax', 'ute.overallLength', 'ute.overallWidth', 'ute.overallHeight'],
  },
  {
    id: 'cannon-l-20d',
    family: 'GWM Cannon',
    name: 'GWM Cannon-L 2.0L diesel',
    years: '2021–2024',
    body: CANNON,
    weights: { kerb: 2100, gvm: 3150, gcm: 5545, payload: 1050, brakedTow: 3000, unbrakedTow: 750, towBallMax: 300 },
    axles: [1450, 1950],
    tare: 2025,
    tyre: { size: '265/65R17', loadIndex: 112 },
    typical: ['ute.tyre.size', 'ute.tyre.loadIndex', 'ute.limits.towBallMax', 'ute.overallLength', 'ute.overallWidth', 'ute.overallHeight'],
  },
];

export const VEHICLES: VehicleModel[] = DEFS.map((d) => ({
  id: d.id,
  family: d.family,
  label: `${d.name.replace(/^GWM /, '')} (${d.years})`,
  spec: () => ({
    model: d.id,
    name: d.name,
    ...structuredClone(d.body),
    tyre: { size: d.tyre.size, loadIndex: d.tyre.loadIndex, loadKg: null },
    limits: { ...d.weights, frontAxle: d.axles[0], rearAxle: d.axles[1], tare: d.tare },
  }),
  placeholders: [...new Set([...ALWAYS_TYPICAL, ...(d.tarePublished ? [] : ['ute.limits.tare']), ...d.typical])],
}));

export const VEHICLE_FAMILIES: VehicleFamily[] = ['GWM Cannon Alpha', 'GWM Cannon'];

export function vehicleModel(id: string): VehicleModel {
  return VEHICLES.find((v) => v.id === id) ?? VEHICLES.find((v) => v.id === DEFAULT_VEHICLE)!;
}
