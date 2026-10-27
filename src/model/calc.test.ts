import { describe, expect, it } from 'vitest';
import {
  capacityAt,
  caravanShare,
  compute,
  deriveCaravanBaseline,
  deriveUteBaseline,
  uteShare,
} from './calc';
import { ITEM_TEMPLATES, applyTrailerKind, itemFromTemplate, newSetup, defaultSettings, emptyCaravanReadings, emptyUteReadings } from './presets';
import { TRAILER_KINDS, trailerPreset } from './trailers';
import type { LoadItem, Setup } from './types';
import { loadIndexKg, rimDiameter, tyreDiameter } from './tyres';
import { axleCentre } from './geometry';
import { normalizeSetup } from './migrate';

const settings = defaultSettings();

function bareSetup(): Setup {
  const s = newSetup('test');
  s.items = [];
  s.towing = false;
  s.uteReadings = { total: null, front: 1400, rear: 1100, fl: 700, fr: 700, rl: 550, rr: 550 };
  return s;
}

function item(partial: Partial<LoadItem>): LoadItem {
  return {
    id: Math.random().toString(36),
    name: 'item',
    mass: 100,
    size: { l: 100, w: 100, h: 100 },
    shape: 'box',
    color: '#000',
    host: 'ute',
    pos: { x: 0, y: 0, z: 500 },
    enabled: true,
    measured: null,
    ...partial,
  };
}

const sum = (w: { fl: number; fr: number; rl: number; rr: number }) => w.fl + w.fr + w.rl + w.rr;

describe('tyres', () => {
  it('maps load index to kg', () => {
    expect(loadIndexKg(109)).toBe(1030);
    expect(loadIndexKg(121)).toBe(1450);
    expect(loadIndexKg(null)).toBeNull();
  });
  it('computes overall diameter', () => {
    expect(tyreDiameter('265/55R19')).toBe(774);
    expect(tyreDiameter('LT265/75R16')).toBe(804);
    expect(tyreDiameter('33x12.5R15')).toBe(838);
  });
  it('reads the rim size', () => {
    expect(rimDiameter('265/55R19')).toBe(19);
    expect(rimDiameter('LT265/75 R16')).toBe(16);
  });
});

describe('uteShare', () => {
  const ute = newSetup().ute;
  const L = ute.wheelbase;
  it('puts a load on the front axle entirely on the front wheels', () => {
    const w = uteShare(100, { x: 0, y: 0, z: 0 }, ute);
    expect(w.fl + w.fr).toBeCloseTo(100);
    expect(w.rl + w.rr).toBeCloseTo(0);
  });
  it('levers a load ahead of the front axle off the rear axle', () => {
    const w = uteShare(40, { x: -1000, y: 0, z: 0 }, ute);
    expect(w.fl + w.fr).toBeCloseTo(40 * (1 + 1000 / L));
    expect(w.rl + w.rr).toBeCloseTo(-40 * (1000 / L));
    expect(sum(w)).toBeCloseTo(40);
  });
  it('splits laterally over the track', () => {
    const w = uteShare(100, { x: L, y: ute.trackRear / 2, z: 0 }, ute);
    expect(w.rr).toBeCloseTo(100);
    expect(w.rl).toBeCloseTo(0);
  });
});

describe('caravanShare', () => {
  const cv = newSetup().caravan;
  it('splits between ball and axle by lever', () => {
    expect(caravanShare(100, { x: 0, y: 0, z: 0 }, cv).ball).toBeCloseTo(100);
    const over = caravanShare(100, { x: axleCentre(cv), y: 0, z: 0 }, cv);
    expect(over.ball).toBeCloseTo(0);
    expect(over.left + over.right).toBeCloseTo(100);
  });
  it('lightens the ball when loaded behind the axle', () => {
    const behind = caravanShare(50, { x: axleCentre(cv) + 2000, y: 0, z: 0 }, cv);
    expect(behind.ball).toBeLessThan(0);
    expect(behind.ball + behind.left + behind.right).toBeCloseTo(50);
  });
});

describe('deriveUteBaseline', () => {
  const ute = newSetup().ute;
  it('uses wheel readings when all four are given', () => {
    const b = deriveUteBaseline({ total: 2600, front: 1450, rear: 1150, fl: 720, fr: 730, rl: 570, rr: 580 }, ute, settings);
    expect(b.source).toBe('wheels');
    expect(sum(b.wheels)).toBe(2600);
    expect(b.issues.filter((i) => i.level !== 'info')).toHaveLength(0);
  });
  it('flags wheels that do not add up to the axle reading', () => {
    const b = deriveUteBaseline({ total: null, front: 1450, rear: null, fl: 720, fr: 800, rl: null, rr: null }, ute, settings);
    expect(b.issues.some((i) => i.message.startsWith('Front wheels'))).toBe(true);
  });
  it('accepts differences within tolerance', () => {
    const b = deriveUteBaseline({ total: 2610, front: 1450, rear: 1150, fl: null, fr: null, rl: null, rr: null }, ute, settings);
    expect(b.issues.some((i) => i.message.includes('vs total'))).toBe(false);
  });
  it('splits axle readings 50/50 and reports the derived wheels', () => {
    const b = deriveUteBaseline({ total: null, front: 1400, rear: 1200, fl: null, fr: null, rl: null, rr: null }, ute, settings);
    expect(b.source).toBe('axles');
    expect(b.wheels.fl).toBe(700);
    expect(b.derived.rr).toBe(600);
    expect(b.derived.total).toBe(2600);
  });
  it('shows axle loads derived from the wheels', () => {
    const b = deriveUteBaseline({ total: null, front: null, rear: null, fl: 700, fr: 720, rl: 560, rr: 570 }, ute, settings);
    expect(b.derived.front).toBe(1420);
    expect(b.derived.rear).toBe(1130);
    expect(b.derived.total).toBe(2550);
  });
  it('derives the other wheel from one wheel and the axle', () => {
    const b = deriveUteBaseline({ total: null, front: 1400, rear: 1200, fl: 680, fr: null, rl: null, rr: null }, ute, settings);
    expect(b.wheels.fr).toBe(720);
    expect(b.derived.fr).toBe(720);
  });
  it('derives an axle from the total', () => {
    const b = deriveUteBaseline({ total: 2600, front: null, rear: 1150, fl: null, fr: null, rl: null, rr: null }, ute, settings);
    expect(b.wheels.fl + b.wheels.fr).toBe(1450);
    expect(b.derived.front).toBe(1450);
  });
  it('falls back to the kerb weight when nothing is measured', () => {
    const b = deriveUteBaseline(emptyUteReadings(), ute, settings);
    expect(b.source).toBe('spec');
    expect(sum(b.wheels)).toBeCloseTo(ute.limits.kerb!);
    expect(b.wheels.fl + b.wheels.fr).toBeCloseTo((ute.limits.kerb! * ute.kerbFrontPct) / 100);
  });
  it('rejects non-positive readings', () => {
    const b = deriveUteBaseline({ ...emptyUteReadings(), front: 0, rear: 1200, total: 2600 }, ute, settings);
    expect(b.issues.some((i) => i.level === 'error')).toBe(true);
  });
});

describe('deriveCaravanBaseline', () => {
  const cv = newSetup().caravan;
  it('derives the axle group from total and ball', () => {
    const b = deriveCaravanBaseline({ ...emptyCaravanReadings(), total: 2600, ball: 250 }, cv, settings);
    expect(b.source).toBe('measured');
    expect(b.loads.left + b.loads.right).toBe(2350);
  });
  it('flags ball + axle that do not add up to the total', () => {
    const b = deriveCaravanBaseline({ ...emptyCaravanReadings(), total: 2600, ball: 250, axle: 2500 }, cv, settings);
    expect(b.issues.some((i) => i.message.startsWith('Ball weight + axle group'))).toBe(true);
  });
  it('falls back to the plate when not weighed', () => {
    const b = deriveCaravanBaseline(emptyCaravanReadings(), cv, settings);
    expect(b.source).toBe('spec');
    expect(b.loads.ball).toBe(cv.limits.tareBall);
  });
});

describe('compute', () => {
  it('adds what-if items to the measured baseline', () => {
    const s = bareSetup();
    s.items = [item({ mass: 40, pos: { x: -1000, y: 0, z: 600 } })];
    const r = compute(s);
    expect(r.ute.gross).toBeCloseTo(2540);
    expect(r.ute.front).toBeGreaterThan(1440);
    expect(r.ute.rear).toBeLessThan(1100);
  });

  it('does not double count an item that was on the vehicle when weighed', () => {
    const s = bareSetup();
    const pos = { x: 3800, y: 0, z: 1000 };
    s.items = [item({ mass: 60, pos, measured: { host: 'ute', pos } })];
    const r = compute(s);
    expect(r.ute.gross).toBeCloseTo(2500);
    expect(r.ute.front).toBeCloseTo(1400);
  });

  it('applies only the difference when a weighed item is moved', () => {
    const s = bareSetup();
    s.items = [item({ mass: 60, pos: { x: 0, y: 0, z: 1000 }, measured: { host: 'ute', pos: { x: 3350, y: 0, z: 1000 } } })];
    const r = compute(s);
    expect(r.ute.gross).toBeCloseTo(2500);
    expect(r.ute.front).toBeCloseTo(1460);
    expect(r.ute.rear).toBeCloseTo(1040);
  });

  it('removes a weighed item that is switched off', () => {
    const s = bareSetup();
    const pos = { x: 0, y: 0, z: 1000 };
    s.items = [item({ mass: 75, pos, measured: { host: 'ute', pos }, enabled: false })];
    expect(compute(s).ute.front).toBeCloseTo(1325);
  });

  it('applies the tow ball lever to both axles', () => {
    const s = bareSetup();
    s.towing = true;
    s.caravanReadings = { ...emptyCaravanReadings(), total: 2600, ball: 260 };
    const r = compute(s);
    const L = s.ute.wheelbase;
    const d = s.hitch.ballOffset;
    expect(r.ute.front).toBeCloseTo(1400 - (260 * d) / L);
    expect(r.ute.rear).toBeCloseTo(1100 + (260 * (L + d)) / L);
    expect(r.ute.gross).toBeCloseTo(2760);
    expect(r.caravan!.mass).toBeCloseTo(2600);
    expect(r.checks.find((c) => c.id === 'gcm')!.value).toBeCloseTo(2500 + 2600);
  });

  it('restores the requested share of the front axle with a WDH', () => {
    const s = bareSetup();
    s.towing = true;
    s.caravanReadings = { ...emptyCaravanReadings(), total: 2600, ball: 260 };
    const lost = (260 * s.hitch.ballOffset) / s.ute.wheelbase;

    s.hitch.wdh = { enabled: true, restorePct: 50 };
    let r = compute(s);
    expect(r.ute.front).toBeCloseTo(1400 - lost / 2);
    // Whatever leaves the ute ends up on the caravan axles; the totals are unchanged.
    expect(r.ute.gross + r.caravan!.axle).toBeCloseTo(2500 + 2600);
    expect(r.hitch!.wdhToCaravan).toBeGreaterThan(0);

    s.hitch.wdh = { enabled: true, restorePct: 100 };
    r = compute(s);
    expect(r.ute.front).toBeCloseTo(1400);
  });

  it('moves the ball weight with caravan items', () => {
    const s = bareSetup();
    s.towing = true;
    s.caravanReadings = { ...emptyCaravanReadings(), total: 2600, ball: 260 };
    s.items = [item({ host: 'caravan', mass: 38, pos: { x: 900, y: 0, z: 600 } })];
    const r = compute(s);
    const a = axleCentre(s.caravan);
    expect(r.hitch!.ball).toBeCloseTo(260 + 38 * (1 - 900 / a));
  });

  it('ignores caravan items when not towing', () => {
    const s = bareSetup();
    s.items = [item({ host: 'caravan', mass: 100, pos: { x: 900, y: 0, z: 600 } })];
    const r = compute(s);
    expect(r.ute.gross).toBeCloseTo(2500);
    expect(r.issues.some((i) => i.message.includes('ignored'))).toBe(true);
  });

  it('flags limits that are exceeded or close', () => {
    const s = bareSetup();
    s.ute.limits.frontAxle = 1420;
    s.ute.limits.rearAxle = 1000;
    const r = compute(s);
    expect(r.checks.find((c) => c.id === 'frontAxle')!.status).toBe('near');
    expect(r.checks.find((c) => c.id === 'rearAxle')!.status).toBe('over');
    expect(r.checks.find((c) => c.id === 'gvm')!.status).toBe('ok');
  });

  it('checks each wheel against the tyre load index', () => {
    const s = bareSetup();
    s.ute.tyre.loadIndex = 100; // 800 kg
    s.uteReadings = { ...s.uteReadings, fl: 820, fr: 580 };
    const r = compute(s);
    expect(r.checks.find((c) => c.id === 'tyre_fl')!.status).toBe('over');
    expect(r.checks.find((c) => c.id === 'tyre_fr')!.status).toBe('ok');
  });
});

describe('capacityAt', () => {
  it('finds the first limit reached at a position', () => {
    const s = bareSetup();
    s.ute.limits.gvm = 3000;
    s.ute.limits.rearAxle = 1300;
    s.ute.limits.frontAxle = 2000;
    s.ute.tyre.loadIndex = null;
    s.ute.limits.payload = null;
    // Over the rear axle every kg lands on the rear axle: 200 kg of room.
    const atRear = capacityAt(s, 'ute', { x: s.ute.wheelbase, y: 0, z: 0 });
    expect(atRear.kg).toBeCloseTo(200);
    expect(atRear.limitedBy).toBe('Rear axle');
    // Midway, half goes to the rear: 400 kg of rear-axle room but only 500 kg of GVM.
    const mid = capacityAt(s, 'ute', { x: s.ute.wheelbase / 2, y: 0, z: 0 });
    expect(mid.kg).toBeCloseTo(400);
  });
});

describe('itemFromTemplate', () => {
  it('stacks items added to the same spot', () => {
    const s = newSetup();
    const rack = itemFromTemplate(ITEM_TEMPLATES.find((t) => t.id === 'roofRack')!, s);
    s.items.push(rack);
    const tent = itemFromTemplate(ITEM_TEMPLATES.find((t) => t.id === 'rtt')!, s);
    expect(tent.pos.z - tent.size.h / 2).toBeCloseTo(rack.pos.z + rack.size.h / 2);
  });
  it('fills free seats first', () => {
    const s = newSetup();
    const passenger = itemFromTemplate(ITEM_TEMPLATES.find((t) => t.id === 'passenger')!, s);
    expect(passenger.pos.y).toBeLessThan(0);
    expect(Math.abs(passenger.pos.x - s.items[0].pos.x)).toBeLessThan(1);
  });
});

describe('caravan axles', () => {
  it('treats a tandem as one axle at the average distance from the ball', () => {
    const cv = { ...newSetup().caravan, axles: [4600, 5600] };
    expect(axleCentre(cv)).toBe(5100);
    const atFrontAxle = caravanShare(100, { x: 4600, y: 0, z: 0 }, cv);
    expect(atFrontAxle.ball).toBeCloseTo(100 * (1 - 4600 / 5100));
  });

  it('uses the single axle position directly', () => {
    const cv = { ...newSetup().caravan, axles: [4200] };
    const over = caravanShare(100, { x: 4200, y: 0, z: 0 }, cv);
    expect(over.ball).toBeCloseTo(0);
  });

  it('moves the ball weight when an axle is moved', () => {
    const s = bareSetup();
    s.towing = true;
    s.caravanReadings = { ...emptyCaravanReadings(), total: 2600, ball: 260 };
    s.items = [item({ host: 'caravan', mass: 100, pos: { x: 3000, y: 0, z: 800 } })];
    s.caravan.axles = [4800, 5800];
    const before = compute(s).hitch!.ball;
    s.caravan.axles = [5300, 6300];
    expect(compute(s).hitch!.ball).toBeGreaterThan(before);
  });

  it('counts the tyres per side from the number of axles', () => {
    const s = bareSetup();
    s.towing = true;
    s.caravanReadings = { ...emptyCaravanReadings(), total: 2600, ball: 260 };
    s.caravan.axles = [5300];
    const single = compute(s).checks.find((c) => c.id === 'cvTyre_left')!.value;
    s.caravan.axles = [4800, 5800];
    expect(compute(s).checks.find((c) => c.id === 'cvTyre_left')!.value).toBeCloseTo(single / 2);
  });

  it('warns when tandem axles are closer than a tyre diameter', () => {
    const s = bareSetup();
    s.towing = true;
    s.caravan.axles = [5000, 5300];
    expect(compute(s).issues.some((i) => i.fields?.includes('caravan.axles.1'))).toBe(true);
  });

  it('upgrades setups saved with one axle-group distance', () => {
    const old = structuredClone(newSetup()) as unknown as Record<string, any>;
    delete old.caravan.axles;
    Object.assign(old.caravan, { couplingToAxle: 5200, axleCount: 2, axleSpacing: 900 });
    old.placeholders = ['caravan.couplingToAxle', 'caravan.axleSpacing', 'ute.limits.tare'];
    const s = normalizeSetup(old);
    expect(s.caravan.axles).toEqual([4750, 5650]);
    expect('couplingToAxle' in s.caravan).toBe(false);
    expect(s.placeholders).toEqual(['ute.limits.tare', 'caravan.axles.0', 'caravan.axles.1']);

    Object.assign(old.caravan, { axleCount: 1 });
    expect(normalizeSetup(old).caravan.axles).toEqual([5200]);
  });
});

describe('caravan front and rear axle weights', () => {
  const tandem = () => ({ ...newSetup().caravan, axles: [4800, 5800] });

  it('takes the axle group from the front and rear axle readings', () => {
    const b = deriveCaravanBaseline({ ...emptyCaravanReadings(), ball: 250, axleFront: 1180, axleRear: 1170 }, tandem(), settings);
    expect(b.source).toBe('measured');
    expect(b.axles).toEqual([1180, 1170]);
    expect(b.derived.axle).toBe(2350);
    expect(b.derived.total).toBe(2600);
  });

  it('derives the other axle from one axle and the group', () => {
    const b = deriveCaravanBaseline({ ...emptyCaravanReadings(), total: 2600, ball: 250, axleFront: 1200 }, tandem(), settings);
    expect(b.axles).toEqual([1200, 1150]);
    expect(b.derived.axleRear).toBe(1150);
  });

  it('flags axle readings that do not add up to the group', () => {
    const b = deriveCaravanBaseline({ ...emptyCaravanReadings(), axle: 2350, axleFront: 1180, axleRear: 1270 }, tandem(), settings);
    expect(b.issues.some((i) => i.message.startsWith('Caravan front + rear axle vs axle group'))).toBe(true);
  });

  it('flags a large front/rear imbalance', () => {
    const b = deriveCaravanBaseline({ ...emptyCaravanReadings(), ball: 250, axleFront: 1400, axleRear: 950 }, tandem(), settings);
    expect(b.issues.some((i) => i.fields?.includes('caravanReadings.axleRear') && i.level === 'warn')).toBe(true);
  });

  it('splits an unmeasured group evenly and ignores per-axle readings on a single axle', () => {
    expect(deriveCaravanBaseline({ ...emptyCaravanReadings(), total: 2600, ball: 260 }, tandem(), settings).axles).toEqual([1170, 1170]);
    const single = { ...newSetup().caravan, axles: [5300] };
    const b = deriveCaravanBaseline({ ...emptyCaravanReadings(), total: 2600, ball: 260, axleFront: 900, axleRear: 900 }, single, settings);
    expect(b.axles).toEqual([2340]);
    expect(b.issues.filter((i) => i.level !== 'info')).toHaveLength(0);
  });

  it('shares later changes equally and checks each axle against its share of the TGALR', () => {
    const s = bareSetup();
    s.towing = true;
    s.caravan.axles = [4800, 5800];
    s.caravan.limits.tgalr = 2480;
    s.caravanReadings = { ...emptyCaravanReadings(), ball: 250, axleFront: 1220, axleRear: 1130 };
    s.items = [item({ host: 'caravan', mass: 100, pos: { x: 5300, y: 0, z: 800 } })];
    const r = compute(s);
    expect(r.caravan!.axleLoads[0]).toBeCloseTo(1270);
    expect(r.caravan!.axleLoads[1]).toBeCloseTo(1180);
    expect(r.checks.find((c) => c.id === 'cvAxle_0')!.status).toBe('over');
    expect(r.checks.find((c) => c.id === 'cvAxle_1')!.status).toBe('near');
    expect(r.checks.find((c) => c.id === 'tgalr')).toMatchObject({ value: 2450, limit: 2480, status: 'near' });
    // The heaviest axle sets the tyre check.
    expect(r.checks.find((c) => c.id === 'cvTyre_left')!.value).toBeCloseTo(1270 / 2);
  });

  it('checks a single axle against the whole TGALR', () => {
    const s = bareSetup();
    s.towing = true;
    s.caravan.axles = [5300];
    s.caravan.limits.tgalr = 2000;
    s.caravanReadings = { ...emptyCaravanReadings(), ball: 250, axle: 2100 };
    const r = compute(s);
    expect(r.checks.find((c) => c.id === 'tgalr')).toBeUndefined();
    expect(r.checks.find((c) => c.id === 'cvAxle_0')).toMatchObject({ label: 'Caravan axle vs TGALR', value: 2100, limit: 2000, status: 'over' });
  });
});

describe('compliance plate', () => {
  // Ratings and masses as printed on a tandem caravan's plate, tyre load rating in kg.
  const plated = () => {
    const s = bareSetup();
    s.towing = true;
    s.caravan.axles = [4900, 5800];
    s.caravan.limits = { tare: 2689, tareBall: 174, gtm: 3326, atm: 3500, tgalr: 3500 };
    s.caravan.tyre = { size: '265/75R16', loadIndex: null, loadKg: 1550 };
    return s;
  };

  it('checks against the plate values as entered', () => {
    const r = compute(plated());
    const limit = (id: string) => r.checks.find((c) => c.id === id)?.limit;
    expect(limit('atm')).toBe(3500);
    expect(limit('gtm')).toBe(3326);
    expect(limit('tgalr')).toBe(3500);
    expect(limit('cvAxle_0')).toBe(1750);
    expect(limit('cvTyre_left')).toBe(1550);
    expect(r.checks.find((c) => c.id === 'cvTyre_left')!.detail).toBe('Rated 1,550 kg per tyre.');
  });

  it('uses the tyre load rating in kg over the load index, and the index when no rating is given', () => {
    const s = plated();
    s.caravan.tyre.loadIndex = 121;
    expect(compute(s).checks.find((c) => c.id === 'cvTyre_left')!.limit).toBe(1550);
    s.caravan.tyre.loadKg = null;
    expect(compute(s).checks.find((c) => c.id === 'cvTyre_left')!.limit).toBe(1450);
  });
});

describe('trailer types', () => {
  it.each(TRAILER_KINDS.map((k) => k.kind))('has a consistent %s preset', (kind) => {
    const cv = trailerPreset(kind);
    expect(cv.kind).toBe(kind);
    // Axles sit under the body, the tare ball weight is a sensible share, and the plate adds up.
    for (const x of cv.axles) {
      expect(x).toBeGreaterThan(cv.bodyStart);
      expect(x).toBeLessThan(cv.bodyStart + cv.bodyLength);
    }
    const ballPct = (cv.limits.tareBall! / cv.limits.tare!) * 100;
    expect(ballPct).toBeGreaterThan(5);
    expect(ballPct).toBeLessThan(15);
    expect(cv.limits.gtm!).toBeLessThanOrEqual(cv.limits.atm!);
    expect(cv.limits.tgalr!).toBeGreaterThanOrEqual(cv.limits.gtm!);
  });

  it('switches type: new preset, readings cleared, old trailer items removed', () => {
    const s = newSetup();
    s.caravanReadings.total = 2600;
    s.items.push(itemFromTemplate(ITEM_TEMPLATES.find((t) => t.id === 'gas')!, s));
    s.placeholders = s.placeholders.filter((p) => p !== 'caravan.limits.atm');
    applyTrailerKind(s, 'open');
    expect(s.caravan.kind).toBe('open');
    expect(s.caravan.hasBrakes).toBe(false);
    expect(s.caravanReadings.total).toBeNull();
    expect(s.items.some((i) => i.host === 'caravan')).toBe(false);
    expect(s.items.some((i) => i.templateId === 'driver')).toBe(true);
    expect(s.placeholders).toContain('caravan.limits.atm');
    expect(s.placeholders).not.toContain('caravan.axles.1');
  });

  it('puts the boat, motor and fuel on a boat trailer with a sensible ball weight', () => {
    const s = newSetup();
    applyTrailerKind(s, 'boat');
    const boatItems = s.items.filter((i) => i.host === 'caravan');
    expect(boatItems.map((i) => i.templateId)).toEqual(['boatHull', 'outboard', 'boatFuel']);
    const hull = boatItems[0];
    const motor = boatItems[1];
    // Motor hangs off the transom, fuel sits inside the hull.
    expect(motor.pos.x).toBeGreaterThan(hull.pos.x + hull.size.l / 2 - 200);
    expect(boatItems[2].pos.z).toBeLessThan(hull.pos.z + hull.size.h / 2);
    const r = compute(s);
    expect(r.caravan!.ballPct).toBeGreaterThan(7);
    expect(r.caravan!.ballPct).toBeLessThan(13);
    expect(r.checks.find((c) => c.id === 'atm')!.label).toBe('Boat trailer mass vs ATM');
  });

  it('checks an unbraked trailer against the unbraked towing capacity', () => {
    const s = newSetup();
    applyTrailerKind(s, 'open');
    const tow = compute(s).checks.find((c) => c.id === 'towCapacity')!;
    expect(tow.label).toBe('Trailer mass vs unbraked towing capacity');
    expect(tow.limit).toBe(s.ute.limits.unbrakedTow);
  });

  it('keeps old saves as caravans', () => {
    const old = structuredClone(newSetup()) as unknown as Record<string, any>;
    delete old.caravan.kind;
    expect(normalizeSetup(old).caravan.kind).toBe('caravan');
  });
});
