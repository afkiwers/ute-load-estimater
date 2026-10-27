// GWM Cannon and Cannon Alpha dual-cab utes, as sold in Australia.
//
// The current range comes from GWM Australia's brochures (Cannon Alpha, current at
// 14/10/2026; Cannon, 16/10/2026). Earlier models are no longer in a brochure; their
// kerb weight, GVM, GCM, payload and towing come from Australian spec listings
// (CarExpert, carsales, Drive, CarsGuide, 4X4 Australia).
//
// Each model lists the setup paths that hold typical rather than published values, so
// the app marks them as placeholders to check against the vehicle's placard.

import type { UteLimits, UteSpec } from './types';

export type VehicleGroup = 'GWM Cannon Alpha' | 'GWM Cannon' | 'Earlier models';

export interface VehicleModel {
  id: string;
  group: VehicleGroup;
  /** As listed in the picker. */
  label: string;
  spec: () => Omit<UteSpec, 'paint'>;
  /** Setup paths under "ute." holding typical rather than published values. */
  placeholders: string[];
}

export const DEFAULT_VEHICLE = 'alpha-vanta-30d';

/** Published for no model. */
const ALWAYS_TYPICAL = ['ute.trackFront', 'ute.trackRear', 'ute.frontOverhang', 'ute.tub.floorHeight'];
const TUB = ['ute.tub.length', 'ute.tub.width', 'ute.tub.depth'];
const OVERALL = ['ute.overallLength', 'ute.overallWidth', 'ute.overallHeight'];
const AXLES = ['ute.limits.frontAxle', 'ute.limits.rearAxle'];

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
  kerbFrontPct: 58,
};

/** Front axle share of the kerb weight from the published axle loads at kerb, in %. */
const split = (front: number, rear: number) => Math.round((front / (front + rear)) * 1000) / 10;

interface Def {
  id: string;
  group: VehicleGroup;
  name: string;
  /** Model years, shown for earlier models. */
  years?: string;
  body: Body;
  limits: UteLimits;
  tyre: { size: string; loadIndex: number };
  /** Panoramic sunroof as standard (brochure "Panoramic Sunroof" or "Sunroof"). */
  sunroof?: true;
  /** Paths whose values here are typical, on top of ALWAYS_TYPICAL. */
  typical: string[];
}

const ALPHA_30D: UteLimits = {
  gvm: 3495,
  gcm: 6555,
  frontAxle: 1680,
  rearAxle: 2026,
  kerb: 2550,
  tare: 2458,
  payload: 945,
  brakedTow: 3500,
  unbrakedTow: 750,
  towBallMax: 350,
};

const ALPHA_PHEV: UteLimits = {
  gvm: 3495,
  gcm: 6745,
  frontAxle: 1680,
  rearAxle: 2250,
  kerb: 2810,
  tare: 2761,
  payload: 685,
  brakedTow: 3500,
  unbrakedTow: 750,
  towBallMax: 350,
};

const CANNON_24D: UteLimits = {
  gvm: 3225,
  gcm: 6200,
  frontAxle: 1500,
  rearAxle: 1950,
  kerb: 2230,
  tare: 2173,
  payload: 995,
  brakedTow: 3500,
  unbrakedTow: 750,
  towBallMax: 350,
};

const CANNON_PHEV: UteLimits = {
  gvm: 3420,
  gcm: 6400,
  frontAxle: 1500,
  rearAxle: 2005,
  kerb: 2585,
  tare: 2525,
  payload: 835,
  brakedTow: 3500,
  unbrakedTow: 750,
  towBallMax: 350,
};

const CANNON_20D_EARLIER: UteLimits = {
  gvm: 3150,
  gcm: 5545,
  frontAxle: 1500,
  rearAxle: 1915,
  kerb: 2100,
  tare: 2025,
  payload: 1050,
  brakedTow: 3000,
  unbrakedTow: 750,
  towBallMax: 300,
};

const CANNON_24D_BODY: Body = { ...CANNON, kerbFrontPct: split(1295, 935) };
const CANNON_PHEV_BODY: Body = { ...CANNON, overallHeight: 1886, tub: { ...CANNON.tub, depth: 517.5 }, kerbFrontPct: split(1305, 1280) };

const DEFS: Def[] = [
  // Current Cannon Alpha range (brochure, 14/10/2026). Tub sizes and the kerb weight split are not given.
  {
    id: 'alpha-vanta-30d',
    sunroof: true,
    group: 'GWM Cannon Alpha',
    name: 'GWM Cannon Alpha Vanta 3.0L diesel',
    body: ALPHA,
    limits: ALPHA_30D,
    tyre: { size: '265/55R19', loadIndex: 109 },
    typical: [...TUB, 'ute.kerbFrontPct'],
  },
  {
    id: 'alpha-lux-30d',
    group: 'GWM Cannon Alpha',
    name: 'GWM Cannon Alpha Lux 3.0L diesel',
    body: ALPHA,
    limits: ALPHA_30D,
    tyre: { size: '265/60R18', loadIndex: 110 },
    typical: [...TUB, 'ute.kerbFrontPct', 'ute.tyre.loadIndex'],
  },
  {
    id: 'alpha-ultra-phev',
    sunroof: true,
    group: 'GWM Cannon Alpha',
    name: 'GWM Cannon Alpha Ultra PHEV',
    body: ALPHA,
    limits: ALPHA_PHEV,
    tyre: { size: '265/60R18', loadIndex: 110 },
    typical: [...TUB, 'ute.kerbFrontPct', 'ute.tyre.loadIndex'],
  },
  {
    id: 'alpha-lux-phev',
    group: 'GWM Cannon Alpha',
    name: 'GWM Cannon Alpha Lux PHEV',
    body: ALPHA,
    limits: ALPHA_PHEV,
    tyre: { size: '265/60R18', loadIndex: 110 },
    typical: [...TUB, 'ute.kerbFrontPct', 'ute.tyre.loadIndex'],
  },

  // Current Cannon range (brochure, 16/10/2026), including the axle loads at kerb weight.
  {
    id: 'cannon-xsr-24d',
    sunroof: true,
    group: 'GWM Cannon',
    name: 'GWM Cannon XSR 2.4L diesel',
    body: { ...CANNON, overallLength: 5439, overallWidth: 1958, overallHeight: 1893, kerbFrontPct: split(1345, 985) },
    limits: { gvm: 3205, gcm: 6300, frontAxle: 1585, rearAxle: 1850, kerb: 2330, tare: 2273, payload: 875, brakedTow: 3500, unbrakedTow: 750, towBallMax: 350 },
    tyre: { size: '265/60R18', loadIndex: 110 },
    typical: ['ute.tyre.loadIndex'],
  },
  {
    id: 'cannon-vanta-24d',
    sunroof: true,
    group: 'GWM Cannon',
    name: 'GWM Cannon Vanta 2.4L diesel',
    body: CANNON_24D_BODY,
    limits: CANNON_24D,
    tyre: { size: '265/60R18', loadIndex: 110 },
    typical: ['ute.tyre.loadIndex'],
  },
  {
    id: 'cannon-ultra-24d',
    sunroof: true,
    group: 'GWM Cannon',
    name: 'GWM Cannon Ultra 2.4L diesel',
    body: CANNON_24D_BODY,
    limits: CANNON_24D,
    tyre: { size: '265/60R18', loadIndex: 110 },
    typical: ['ute.tyre.loadIndex'],
  },
  {
    id: 'cannon-lux-24d',
    group: 'GWM Cannon',
    name: 'GWM Cannon Lux 2.4L diesel',
    body: CANNON_24D_BODY,
    limits: CANNON_24D,
    tyre: { size: '265/60R18', loadIndex: 110 },
    typical: ['ute.tyre.loadIndex'],
  },
  {
    // The tray is modelled as a low-sided tub. The brochure's axle loads at kerb add up to
    // the Premium's kerb weight rather than this one's, so the split is the dual cab's.
    id: 'cannon-lux-cc-24d',
    group: 'GWM Cannon',
    name: 'GWM Cannon Lux 2.4L diesel dual cab chassis',
    body: { ...CANNON, overallLength: 5531, overallWidth: 2043, overallHeight: 1997, tub: { length: 1730, width: 1895, depth: 250, floorHeight: 950 }, kerbFrontPct: split(1295, 935) },
    limits: { ...CANNON_24D, rearAxle: 1915 },
    tyre: { size: '265/60R18', loadIndex: 110 },
    typical: ['ute.tyre.loadIndex', 'ute.kerbFrontPct'],
  },
  {
    id: 'cannon-ultra-phev',
    sunroof: true,
    group: 'GWM Cannon',
    name: 'GWM Cannon Ultra PHEV',
    body: CANNON_PHEV_BODY,
    limits: { ...CANNON_PHEV, tare: 2530 },
    tyre: { size: '265/60R18', loadIndex: 110 },
    typical: ['ute.tyre.loadIndex'],
  },
  {
    id: 'cannon-lux-phev',
    group: 'GWM Cannon',
    name: 'GWM Cannon Lux PHEV',
    body: CANNON_PHEV_BODY,
    limits: CANNON_PHEV,
    tyre: { size: '265/60R18', loadIndex: 110 },
    typical: ['ute.tyre.loadIndex'],
  },
  {
    id: 'cannon-premium-20d',
    group: 'GWM Cannon',
    name: 'GWM Cannon Premium 2.0L diesel',
    body: { ...CANNON, kerbFrontPct: split(1245, 895) },
    limits: { gvm: 3135, gcm: 5830, frontAxle: 1500, rearAxle: 1915, kerb: 2140, tare: 2083, payload: 995, brakedTow: 3200, unbrakedTow: 750, towBallMax: 320 },
    tyre: { size: '265/60R18', loadIndex: 110 },
    typical: ['ute.tyre.loadIndex'],
  },

  // Earlier models, from spec listings. Axle limits, tare and tub sizes are typical
  // values from the closest current model.
  {
    id: 'alpha-ultra-24d',
    sunroof: true,
    group: 'Earlier models',
    name: 'GWM Cannon Alpha Ultra 2.4L diesel',
    years: '2024–2026',
    body: ALPHA,
    limits: { ...ALPHA_30D, gvm: 3310, kerb: 2550, tare: 2458, payload: 760 },
    tyre: { size: '265/60R18', loadIndex: 110 },
    typical: [...TUB, ...AXLES, 'ute.limits.tare', 'ute.kerbFrontPct', 'ute.tyre.loadIndex'],
  },
  {
    id: 'alpha-lux-24d',
    group: 'Earlier models',
    name: 'GWM Cannon Alpha Lux 2.4L diesel',
    years: '2024–2026',
    body: ALPHA,
    limits: { ...ALPHA_30D, gvm: 3310, kerb: 2489, tare: 2397, payload: 821 },
    tyre: { size: '265/60R18', loadIndex: 110 },
    typical: [...TUB, ...AXLES, 'ute.limits.tare', 'ute.kerbFrontPct', 'ute.tyre.loadIndex'],
  },
  {
    id: 'alpha-ultra-hybrid',
    sunroof: true,
    group: 'Earlier models',
    name: 'GWM Cannon Alpha Ultra Hybrid 2.0L petrol',
    years: '2024–2025',
    body: ALPHA,
    limits: { ...ALPHA_30D, gvm: 3310, kerb: 2575, tare: 2483, payload: 735 },
    tyre: { size: '265/60R18', loadIndex: 110 },
    typical: [...TUB, ...AXLES, 'ute.limits.tare', 'ute.kerbFrontPct', 'ute.tyre.size', 'ute.tyre.loadIndex', 'ute.limits.towBallMax'],
  },
  {
    id: 'cannon-vanta-20d',
    group: 'Earlier models',
    name: 'GWM Cannon Vanta 2.0L diesel',
    years: '2023–2024',
    body: CANNON,
    limits: CANNON_20D_EARLIER,
    tyre: { size: '265/60R18', loadIndex: 110 },
    typical: [...TUB, ...AXLES, ...OVERALL, 'ute.kerbFrontPct', 'ute.tyre.loadIndex'],
  },
  {
    id: 'cannon-x-20d',
    group: 'Earlier models',
    name: 'GWM Cannon-X 2.0L diesel',
    years: '2021–2024',
    body: CANNON,
    limits: CANNON_20D_EARLIER,
    tyre: { size: '265/65R17', loadIndex: 112 },
    typical: [...TUB, ...AXLES, ...OVERALL, 'ute.limits.tare', 'ute.limits.gcm', 'ute.limits.towBallMax', 'ute.kerbFrontPct', 'ute.tyre.size', 'ute.tyre.loadIndex'],
  },
  {
    id: 'cannon-l-20d',
    group: 'Earlier models',
    name: 'GWM Cannon-L 2.0L diesel',
    years: '2021–2024',
    body: CANNON,
    limits: CANNON_20D_EARLIER,
    tyre: { size: '265/65R17', loadIndex: 112 },
    typical: [...TUB, ...AXLES, ...OVERALL, 'ute.limits.tare', 'ute.limits.towBallMax', 'ute.kerbFrontPct', 'ute.tyre.size', 'ute.tyre.loadIndex'],
  },
];

export const VEHICLES: VehicleModel[] = DEFS.map((d) => ({
  id: d.id,
  group: d.group,
  label: d.name.replace(/^GWM /, '') + (d.years ? ` (${d.years})` : ''),
  spec: () => ({
    model: d.id,
    name: d.name,
    ...structuredClone(d.body),
    tyre: { size: d.tyre.size, loadIndex: d.tyre.loadIndex, loadKg: null },
    limits: { ...d.limits },
    sunroof: !!d.sunroof,
  }),
  placeholders: [...new Set([...ALWAYS_TYPICAL, ...d.typical])],
}));

export const VEHICLE_GROUPS: VehicleGroup[] = ['GWM Cannon Alpha', 'GWM Cannon', 'Earlier models'];

export function vehicleModel(id: string): VehicleModel {
  return VEHICLES.find((v) => v.id === id) ?? VEHICLES.find((v) => v.id === DEFAULT_VEHICLE)!;
}
