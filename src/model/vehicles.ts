// Dual-cab utes and SUVs as sold in Australia: the GWM Cannon and Cannon Alpha, the
// Isuzu D-MAX and the Isuzu MU-X.
//
// The current GWM range comes from GWM Australia's brochures (Cannon Alpha, current at
// 14/10/2026; Cannon, 16/10/2026). Earlier GWM models are no longer in a brochure; their
// kerb weight, GVM, GCM, payload and towing come from Australian spec listings
// (CarExpert, carsales, Drive, CarsGuide, 4X4 Australia). The Isuzus come from Isuzu UTE
// Australia's 25.5MY D-MAX and MU-X brochures.
//
// Each model lists the setup paths that hold typical rather than published values, so
// the app marks them as placeholders to check against the vehicle's placard.

import type { UteLimits, UteSpec } from './types';

export type VehicleGroup = 'GWM Cannon Alpha' | 'GWM Cannon' | 'Earlier GWM models' | 'Isuzu D-MAX' | 'Isuzu MU-X';

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

/** Not in any of the maker's brochures. Isuzu gives the track and front overhang, but not how the kerb weight splits. */
const UNPUBLISHED = {
  GWM: ['ute.trackFront', 'ute.trackRear', 'ute.frontOverhang', 'ute.tub.floorHeight'],
  Isuzu: ['ute.tub.floorHeight', 'ute.kerbFrontPct'],
};
const TUB = ['ute.tub.length', 'ute.tub.width', 'ute.tub.depth'];
const OVERALL = ['ute.overallLength', 'ute.overallWidth', 'ute.overallHeight'];
const AXLES = ['ute.limits.frontAxle', 'ute.limits.rearAxle'];

type Body = Pick<
  UteSpec,
  'bodyStyle' | 'wheelbase' | 'trackFront' | 'trackRear' | 'overallLength' | 'overallWidth' | 'overallHeight' | 'frontOverhang' | 'tub' | 'kerbFrontPct'
>;

const ALPHA: Body = {
  bodyStyle: 'ute',
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
  bodyStyle: 'ute',
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
  /** Paths whose values here are typical, on top of the maker's UNPUBLISHED ones. */
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

  // Earlier GWM models, from spec listings. Axle limits, tare and tub sizes are typical
  // values from the closest current model.
  {
    id: 'alpha-ultra-24d',
    sunroof: true,
    group: 'Earlier GWM models',
    name: 'GWM Cannon Alpha Ultra 2.4L diesel',
    years: '2024–2026',
    body: ALPHA,
    limits: { ...ALPHA_30D, gvm: 3310, kerb: 2550, tare: 2458, payload: 760 },
    tyre: { size: '265/60R18', loadIndex: 110 },
    typical: [...TUB, ...AXLES, 'ute.limits.tare', 'ute.kerbFrontPct', 'ute.tyre.loadIndex'],
  },
  {
    id: 'alpha-lux-24d',
    group: 'Earlier GWM models',
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
    group: 'Earlier GWM models',
    name: 'GWM Cannon Alpha Ultra Hybrid 2.0L petrol',
    years: '2024–2025',
    body: ALPHA,
    limits: { ...ALPHA_30D, gvm: 3310, kerb: 2575, tare: 2483, payload: 735 },
    tyre: { size: '265/60R18', loadIndex: 110 },
    typical: [...TUB, ...AXLES, 'ute.limits.tare', 'ute.kerbFrontPct', 'ute.tyre.size', 'ute.tyre.loadIndex', 'ute.limits.towBallMax'],
  },
  {
    id: 'cannon-vanta-20d',
    group: 'Earlier GWM models',
    name: 'GWM Cannon Vanta 2.0L diesel',
    years: '2023–2024',
    body: CANNON,
    limits: CANNON_20D_EARLIER,
    tyre: { size: '265/60R18', loadIndex: 110 },
    typical: [...TUB, ...AXLES, ...OVERALL, 'ute.kerbFrontPct', 'ute.tyre.loadIndex'],
  },
  {
    id: 'cannon-x-20d',
    group: 'Earlier GWM models',
    name: 'GWM Cannon-X 2.0L diesel',
    years: '2021–2024',
    body: CANNON,
    limits: CANNON_20D_EARLIER,
    tyre: { size: '265/65R17', loadIndex: 112 },
    typical: [...TUB, ...AXLES, ...OVERALL, 'ute.limits.tare', 'ute.limits.gcm', 'ute.limits.towBallMax', 'ute.kerbFrontPct', 'ute.tyre.size', 'ute.tyre.loadIndex'],
  },
  {
    id: 'cannon-l-20d',
    group: 'Earlier GWM models',
    name: 'GWM Cannon-L 2.0L diesel',
    years: '2021–2024',
    body: CANNON,
    limits: CANNON_20D_EARLIER,
    tyre: { size: '265/65R17', loadIndex: 112 },
    typical: [...TUB, ...AXLES, ...OVERALL, 'ute.limits.tare', 'ute.limits.towBallMax', 'ute.kerbFrontPct', 'ute.tyre.size', 'ute.tyre.loadIndex'],
  },
];

// Isuzu D-MAX crew cab utes and MU-X SUVs (25.5MY brochures). The cab chassis D-MAX are left
// out: their published kerb weight is without the tray. Isuzu gives the kerb weight with a
// full tank, so the tare (10 L of fuel) is taken as that less the rest of the diesel. For the
// D-MAX this matches the tare in Australian listings (carsales, trucksales: SX 4x4 crew cab
// ute 1,980 kg, crew cab chassis 1,855 to 1,860 kg); for the MU-X the only current listing
// is 2 kg off, so its tare stays a placeholder.

/** Isuzu's limits: payload is GVM less kerb weight; every model tows 3,500 kg braked with a 350 kg tow ball download. */
function isuzuLimits(gvm: number, gcm: number, kerb: number, tankL: number, frontAxle: number, rearAxle: number): UteLimits {
  const tare = kerb - Math.round((tankL - 10) * 0.835);
  return { gvm, gcm, frontAxle, rearAxle, kerb, tare, payload: gvm - kerb, brakedTow: 3500, unbrakedTow: 750, towBallMax: 350 };
}

const DMAX: Body = {
  bodyStyle: 'ute',
  wheelbase: 3125,
  trackFront: 1570,
  trackRear: 1570,
  overallLength: 5280,
  overallWidth: 1870,
  overallHeight: 1785,
  frontOverhang: 905,
  tub: { length: 1570, width: 1530, depth: 490, floorHeight: 850 },
  kerbFrontPct: 58,
};

const MUX: Body = {
  bodyStyle: 'suv',
  wheelbase: 2855,
  trackFront: 1570,
  trackRear: 1570,
  overallLength: 4860,
  overallWidth: 1870,
  overallHeight: 1825,
  frontOverhang: 905,
  // Drawn as a five seater with the third row folded flat. The cargo floor is not given in mm.
  tub: { length: 1100, width: 1300, depth: 850, floorHeight: 830 },
  kerbFrontPct: 52,
};

// Tyre load indexes are not in the brochures. 255/65R17 110 is Michelin's fitment for the D-MAX SX.
// 265/60R18 110 (one listing says 112, so 110 errs low), 265/50R20 107 and the BLADE's Goodyear
// Wrangler DuraTrac RT 275/65R17 121 are what those tyres are made with, so they stay placeholders.
const R17 = { size: '255/65R17', loadIndex: 110 };
const R18 = { size: '265/60R18', loadIndex: 110 };
const R20 = { size: '265/50R20', loadIndex: 107 };
const R17_BLADE = { size: '275/65R17', loadIndex: 121 };
const loadIndexTypical = (tyre: Def['tyre']) => (tyre === R17 ? [] : ['ute.tyre.loadIndex']);

type Drive = '4x2' | '4x4';

// The brochures give the front axle rating with the 4x4's driven front axle.
const dmax = (id: string, name: string, drive: Drive, kerb: number, body: Partial<Body>, tyre: Def['tyre']): Def => ({
  id,
  group: 'Isuzu D-MAX',
  name: `Isuzu D-MAX ${name} ${drive}`,
  body: { ...DMAX, ...body },
  limits: drive === '4x4' ? isuzuLimits(3100, 6000, kerb, 76, 1450, 1910) : isuzuLimits(3000, 5850, kerb, 76, 1450, 1910),
  tyre,
  typical: [...loadIndexTypical(tyre), ...(drive === '4x2' ? ['ute.limits.frontAxle'] : [])],
});

const mux = (id: string, name: string, drive: Drive, kerb: number, body: Partial<Body>, tyre: Def['tyre']): Def => ({
  id,
  group: 'Isuzu MU-X',
  name: `Isuzu MU-X ${name} ${drive}`,
  body: { ...MUX, ...body },
  limits: isuzuLimits(drive === '4x4' ? 2800 : 2700, 5900, kerb, 80, 1450, 1650),
  tyre,
  typical: [...TUB, 'ute.limits.tare', ...loadIndexTypical(tyre), ...(drive === '4x2' ? ['ute.limits.frontAxle'] : [])],
});

const LS_U: Partial<Body> = { overallLength: 5285, overallHeight: 1790 };
const X_RIDER: Partial<Body> = { overallLength: 5305, frontOverhang: 930 };
const LS_M: Partial<Body> = { overallHeight: 1815 };

const ISUZU: Def[] = [
  dmax('dmax-sx-22d-4x2', 'SX 2.2L diesel', '4x2', 1895, {}, R17),
  dmax('dmax-sx-30d-4x2', 'SX 3.0L diesel', '4x2', 1950, {}, R17),
  dmax('dmax-lsu-30d-4x2', 'LS-U 3.0L diesel', '4x2', 2015, LS_U, R18),
  dmax('dmax-sx-22d', 'SX 2.2L diesel', '4x4', 1980, {}, R17),
  dmax('dmax-sx-30d', 'SX 3.0L diesel', '4x4', 2035, {}, R17),
  dmax('dmax-xrider-22d', 'X-RIDER 2.2L diesel', '4x4', 2010, X_RIDER, R17),
  dmax('dmax-xrider-30d', 'X-RIDER 3.0L diesel', '4x4', 2060, X_RIDER, R17),
  dmax('dmax-lsu-30d', 'LS-U 3.0L diesel', '4x4', 2105, LS_U, R18),
  dmax('dmax-lsu-plus-30d', 'LS-U+ 3.0L diesel', '4x4', 2105, LS_U, R18),
  dmax('dmax-xterrain-30d', 'X-TERRAIN 3.0L diesel', '4x4', 2170, { overallLength: 5310, overallWidth: 1880, overallHeight: 1810, frontOverhang: 930 }, R18),
  dmax(
    'dmax-blade-30d',
    'BLADE 3.0L diesel',
    '4x4',
    2204,
    { overallLength: 5308, overallWidth: 1910, overallHeight: 1810, frontOverhang: 928, trackFront: 1602, trackRear: 1602 },
    R17_BLADE,
  ),
  mux('mux-lsm-22d-4x2', 'LS-M 2.2L diesel', '4x2', 1995, LS_M, R17),
  mux('mux-lsm-22d', 'LS-M 2.2L diesel', '4x4', 2085, LS_M, R17),
  mux('mux-lsm-30d', 'LS-M 3.0L diesel', '4x4', 2140, LS_M, R17),
  mux('mux-lsu-22d', 'LS-U 2.2L diesel', '4x4', 2105, {}, R18),
  mux('mux-lsu-30d', 'LS-U 3.0L diesel', '4x4', 2160, {}, R18),
  mux('mux-lst-22d', 'LS-T 2.2L diesel', '4x4', 2130, {}, R20),
  mux('mux-lst-30d', 'LS-T 3.0L diesel', '4x4', 2185, {}, R20),
  mux('mux-xterrain-30d', 'X-TERRAIN 3.0L diesel', '4x4', 2195, {}, R20),
];

export const VEHICLES: VehicleModel[] = [...DEFS, ...ISUZU].map((d) => ({
  id: d.id,
  group: d.group,
  label: d.name.replace(/^(GWM|Isuzu) /, '') + (d.years ? ` (${d.years})` : ''),
  spec: () => ({
    model: d.id,
    name: d.name,
    ...structuredClone(d.body),
    tyre: { size: d.tyre.size, loadIndex: d.tyre.loadIndex, loadKg: null },
    limits: { ...d.limits },
    sunroof: !!d.sunroof,
  }),
  placeholders: [...new Set([...UNPUBLISHED[d.group.startsWith('Isuzu') ? 'Isuzu' : 'GWM'], ...d.typical])],
}));

export const VEHICLE_GROUPS: VehicleGroup[] = ['GWM Cannon Alpha', 'GWM Cannon', 'Earlier GWM models', 'Isuzu D-MAX', 'Isuzu MU-X'];

export function vehicleModel(id: string): VehicleModel {
  return VEHICLES.find((v) => v.id === id) ?? VEHICLES.find((v) => v.id === DEFAULT_VEHICLE)!;
}
