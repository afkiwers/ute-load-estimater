import type {
  CaravanReadings,
  CaravanSpec,
  CheckSettings,
  HitchSpec,
  Host,
  ItemShape,
  ItemSize,
  LoadItem,
  Setup,
  UteReadings,
  UteSpec,
  Vec3,
} from './types';
import { anchorPlacement, type Anchor } from './geometry';

export function uid(): string {
  // crypto.randomUUID needs a secure context; keep this working from file:// too.
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 9);
}

/**
 * GWM Cannon Alpha Vanta 3.0L diesel. GVM, GCM, kerb, payload, towing, tow ball
 * download, wheelbase and overall dimensions are published figures; the rest
 * are typical values listed in PRESET_PLACEHOLDERS until replaced.
 */
export function cannonAlphaVantaDiesel(): UteSpec {
  return {
    name: 'GWM Cannon Alpha Vanta 3.0L diesel',
    wheelbase: 3350,
    trackFront: 1635,
    trackRear: 1635,
    overallLength: 5445,
    overallWidth: 1991,
    overallHeight: 1924,
    frontOverhang: 950,
    tub: { length: 1485, width: 1520, depth: 540, floorHeight: 880 },
    tyre: { size: '265/55R19', loadIndex: 109 },
    limits: {
      gvm: 3495,
      gcm: 6555,
      frontAxle: 1600,
      rearAxle: 2100,
      kerb: 2550,
      tare: 2432,
      payload: 945,
      brakedTow: 3500,
      unbrakedTow: 750,
      towBallMax: 350,
    },
    kerbFrontPct: 56,
    paint: '#e8eaec',
  };
}

export const PAINTS: { name: string; color: string }[] = [
  { name: 'Pearl white', color: '#e8eaec' },
  { name: 'Silver', color: '#b4b9bf' },
  { name: 'Ironstone', color: '#555a61' },
  { name: 'Bronze', color: '#75664f' },
  { name: 'Sand', color: '#c0a982' },
  { name: 'Black', color: '#141518' },
  { name: 'Red', color: '#8c1c1c' },
  { name: 'Blue', color: '#23405c' },
];

export function defaultHitch(): HitchSpec {
  return {
    ballOffset: 1300,
    ballHeight: 480,
    towbarRating: null,
    towbarBallRating: null,
    wdh: { enabled: false, restorePct: 50 },
  };
}

export function defaultCaravan(): CaravanSpec {
  return {
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
    limits: { atm: 3000, gtm: 2800, tare: 2350, tareBall: 230 },
  };
}

export function defaultSettings(): CheckSettings {
  return { tolAbs: 20, tolPct: 2, nearPct: 95, ballPctMin: 8, ballPctMax: 12, frontUnloadPct: 10 };
}

export const emptyUteReadings = (): UteReadings => ({ total: null, front: null, rear: null, fl: null, fr: null, rl: null, rr: null });
export const emptyCaravanReadings = (): CaravanReadings => ({ total: null, ball: null, axle: null, left: null, right: null });

export const PRESET_PLACEHOLDERS = [
  'ute.trackFront',
  'ute.trackRear',
  'ute.frontOverhang',
  'ute.tub.length',
  'ute.tub.width',
  'ute.tub.depth',
  'ute.tub.floorHeight',
  'ute.tyre.size',
  'ute.tyre.loadIndex',
  'ute.limits.frontAxle',
  'ute.limits.rearAxle',
  'ute.limits.tare',
  'ute.kerbFrontPct',
  'hitch.ballOffset',
  'hitch.ballHeight',
  'caravan.axles.0',
  'caravan.axles.1',
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
];

export interface ItemTemplate {
  id: string;
  name: string;
  category: string;
  mass: number;
  size: ItemSize;
  shape: ItemShape;
  color: string;
  anchor: Anchor;
  /** Lateral offset from the anchor (mm, + = right). */
  offsetY?: number;
  snap?: 'seat';
  note?: string;
}

const t = (
  id: string,
  category: string,
  name: string,
  mass: number,
  [l, w, h]: [number, number, number],
  anchor: Anchor,
  color: string,
  extra: Partial<ItemTemplate> = {},
): ItemTemplate => ({ id, category, name, mass, size: { l, w, h }, anchor, color, shape: 'box', ...extra });

export const ITEM_TEMPLATES: ItemTemplate[] = [
  t('winch', 'Front', 'Winch (12,000 lb)', 40, [260, 560, 260], 'frontBumper', '#3d4652'),
  t('bullbarSteel', 'Front', 'Bull bar (steel)', 75, [320, 1900, 650], 'bullbar', '#2f343b', { shape: 'bullbar' }),
  t('bullbarAlloy', 'Front', 'Bull bar (alloy)', 38, [320, 1900, 650], 'bullbar', '#a7b0ba', { shape: 'bullbar' }),
  t('lights', 'Front', 'Driving lights / light bar', 7, [120, 1000, 120], 'frontBumper', '#e3b93b'),
  t('driver', 'Cabin', 'Driver', 85, [600, 450, 900], 'seat', '#d08a5c', { shape: 'person', snap: 'seat' }),
  t('passenger', 'Cabin', 'Adult passenger', 80, [600, 450, 900], 'seat', '#c9875f', { shape: 'person', snap: 'seat' }),
  t('child', 'Cabin', 'Child', 30, [450, 380, 700], 'seat', '#d9a173', { shape: 'person', snap: 'seat' }),
  t('cabinGear', 'Cabin', 'Bags in rear footwell', 15, [400, 500, 300], 'seat', '#8c7a63'),
  t('roofRack', 'Roof', 'Roof platform rack', 25, [1500, 1350, 80], 'roof', '#30343a'),
  t('rtt', 'Roof', 'Rooftop tent (hard shell)', 70, [1500, 1300, 300], 'roof', '#6b7a5a'),
  t('awning', 'Roof', 'Awning', 22, [2000, 180, 180], 'roof', '#505860', { offsetY: -720 }),
  t('roofSolar', 'Roof', 'Solar panel', 12, [1200, 650, 40], 'roof', '#1f3550'),
  t('drawers', 'Tub', 'Drawer system', 65, [1100, 1200, 300], 'tubRear', '#7b6b55'),
  t('fridge', 'Tub', 'Fridge 60 L (loaded)', 50, [700, 450, 520], 'tub', '#dfe3e8'),
  t('waterTank', 'Tub', 'Water tank 70 L (full)', 78, [600, 900, 200], 'tubFront', '#2a6fdb'),
  t('jerryDiesel', 'Tub', 'Jerry can 20 L diesel', 21, [350, 170, 470], 'tub', '#c63b32'),
  t('jerryWater', 'Tub', 'Jerry can 20 L water', 21, [350, 170, 470], 'tub', '#2a8adb'),
  t('battery', 'Tub', 'Lithium battery 100 Ah', 14, [330, 175, 220], 'tubFront', '#4b5563'),
  t('toolbox', 'Tub', 'Toolbox', 25, [600, 300, 300], 'tub', '#b4432f'),
  t('recovery', 'Tub', 'Recovery gear', 15, [450, 300, 250], 'tub', '#d97a1e'),
  t('camping', 'Tub', 'Camping gear', 40, [800, 600, 400], 'tub', '#5d7a8c'),
  t('spare2', 'Tub', 'Second spare wheel', 32, [790, 790, 265], 'tub', '#222', { shape: 'cylinder' }),
  t('lrTank', 'Tub', 'Long-range fuel tank (full)', 85, [900, 700, 250], 'underTub', '#555d66', { note: 'Mounted under the tub.' }),
  t('towbar', 'Tow bar', 'Tow bar + tongue', 32, [900, 1100, 180], 'hitch', '#1d1f22'),
  t('bikeRack', 'Tow bar', 'Hitch bike rack + 2 bikes', 45, [600, 1200, 900], 'towbar', '#5b8c3a'),
  t('gas', 'Caravan drawbar', 'Gas bottle 9 kg (full)', 19, [320, 320, 600], 'cvDrawbar', '#e8e8e8', { shape: 'cylinder' }),
  t('drawbarBox', 'Caravan drawbar', 'Drawbar toolbox (loaded)', 45, [450, 1200, 450], 'cvDrawbar', '#6a7178'),
  t('cvJerry', 'Caravan drawbar', 'Jerry can 20 L', 21, [350, 170, 470], 'cvDrawbar', '#c63b32'),
  t('generator', 'Caravan drawbar', 'Generator 2 kVA', 24, [500, 300, 450], 'cvDrawbar', '#d64f2a'),
  t('cvWater', 'Caravan inside', 'Fresh water tank 95 L (full)', 102, [900, 700, 180], 'cvUnderFloor', '#2a6fdb', { note: 'Under-floor tank.' }),
  t('cvGrey', 'Caravan inside', 'Grey water tank 95 L (full)', 100, [900, 700, 180], 'cvUnderFloor', '#7a7f55'),
  t('cvBattery', 'Caravan inside', 'Lithium battery 200 Ah', 25, [520, 240, 220], 'cvFloorFront', '#4b5563'),
  t('food', 'Caravan inside', 'Food and drinks', 60, [800, 500, 500], 'cvFloorCentre', '#e0a43a'),
  t('clothes', 'Caravan inside', 'Clothes and bedding', 40, [900, 600, 400], 'cvFloorFront', '#9b7fb8'),
  t('kitchen', 'Caravan inside', 'Kitchen gear', 30, [600, 500, 400], 'cvFloorCentre', '#c9b28a'),
  t('annex', 'Caravan inside', 'Annexe', 30, [2400, 300, 250], 'cvFloorCentre', '#738a6b'),
  t('cvAircon', 'Caravan outside', 'Roof air conditioner', 38, [1000, 700, 250], 'cvRoof', '#f1f1f1'),
  t('cvSolar', 'Caravan outside', 'Roof solar 2 × 200 W', 24, [1600, 1000, 40], 'cvRoof', '#1f3550'),
  t('cvBikes', 'Caravan outside', 'Bikes on rear rack (2)', 40, [500, 1600, 1000], 'cvRearBumper', '#5b8c3a'),
  t('cvSpare', 'Caravan outside', 'Spare wheel (rear)', 26, [240, 730, 730], 'cvRearBumper', '#222', { shape: 'cylinder' }),
];

const STACKING: Anchor[] = ['roof', 'tub', 'tubFront', 'tubRear', 'cvDrawbar', 'cvFloorFront', 'cvFloorCentre', 'cvFloorRear', 'cvRoof'];

/** Raises a new item resting at `pos` onto whatever already occupies that footprint. */
function stackOnTop(pos: Vec3, size: ItemSize, host: Host, items: LoadItem[]): Vec3 {
  let bottom = pos.z - size.h / 2;
  for (let pass = 0; pass < items.length; pass++) {
    let raised = false;
    for (const it of items) {
      if (it.host !== host) continue;
      const overlapX = Math.abs(it.pos.x - pos.x) < (it.size.l + size.l) / 2 - 1;
      const overlapY = Math.abs(it.pos.y - pos.y) < (it.size.w + size.w) / 2 - 1;
      const itTop = it.pos.z + it.size.h / 2;
      const itBottom = it.pos.z - it.size.h / 2;
      if (overlapX && overlapY && itTop > bottom + 1 && itBottom < bottom + size.h - 1) {
        bottom = itTop;
        raised = true;
      }
    }
    if (!raised) break;
  }
  return { ...pos, z: bottom + size.h / 2 };
}

export function itemFromTemplate(tpl: ItemTemplate, setup: Setup): LoadItem {
  const occupied = setup.items.filter((i) => i.snap === 'seat' && i.host === 'ute').map((i) => i.pos);
  const placement = anchorPlacement(tpl.anchor, tpl.size, setup, occupied);
  if (tpl.offsetY) placement.pos.y += tpl.offsetY;
  if (STACKING.includes(tpl.anchor)) placement.pos = stackOnTop(placement.pos, tpl.size, placement.host, setup.items);
  return {
    id: uid(),
    name: tpl.name,
    mass: tpl.mass,
    size: { ...tpl.size },
    shape: tpl.shape,
    color: tpl.color,
    host: placement.host,
    pos: placement.pos,
    enabled: true,
    measured: null,
    snap: tpl.snap,
    templateId: tpl.id,
  };
}

export function newSetup(name = 'My setup'): Setup {
  const setup: Setup = {
    id: uid(),
    name,
    updatedAt: Date.now(),
    ute: cannonAlphaVantaDiesel(),
    uteReadings: emptyUteReadings(),
    hitch: defaultHitch(),
    towing: true,
    caravan: defaultCaravan(),
    caravanReadings: emptyCaravanReadings(),
    items: [],
    settings: defaultSettings(),
    placeholders: [...PRESET_PLACEHOLDERS],
  };
  const driver = ITEM_TEMPLATES.find((x) => x.id === 'driver')!;
  setup.items.push(itemFromTemplate(driver, setup));
  return setup;
}
