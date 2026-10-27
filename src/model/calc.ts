// Static load model.
//
// Longitudinally the ute is a beam on two supports (front and rear axle) and
// the caravan a beam on the tow ball and its axle group. Laterally each axle
// splits its share between its two wheels by lever over the track. A rigid
// four-wheel vehicle is statically indeterminate side to side, so this per-axle
// split ignores roll stiffness; it is the usual approximation for load planning.

import type {
  CaravanReadings,
  CaravanSpec,
  CheckSettings,
  Host,
  LoadItem,
  Setup,
  UteReadings,
  UteSpec,
  Vec3,
} from './types';
import { kg, mm, num, pct, signedKg } from './format';
import { axleCentre } from './geometry';
import { loadIndexKg, tyreDiameter } from './tyres';

export type WheelId = 'fl' | 'fr' | 'rl' | 'rr';
export type WheelLoads = Record<WheelId, number>;
export const WHEEL_IDS: WheelId[] = ['fl', 'fr', 'rl', 'rr'];
export const WHEEL_NAMES: Record<WheelId, string> = {
  fl: 'Front left',
  fr: 'Front right',
  rl: 'Rear left',
  rr: 'Rear right',
};

export interface CaravanLoads {
  ball: number;
  left: number;
  right: number;
}

export type IssueLevel = 'error' | 'warn' | 'info';

export interface Issue {
  level: IssueLevel;
  message: string;
  /** Setup paths of the readings the issue refers to, e.g. "uteReadings.fl". */
  fields?: string[];
}

export type UteBaselineSource = 'wheels' | 'axles' | 'partial' | 'spec';
export type CaravanBaselineSource = 'measured' | 'partial' | 'spec';

export interface UteBaseline {
  wheels: WheelLoads;
  source: UteBaselineSource;
  /** Values filled in for readings that were left empty. */
  derived: Partial<Record<keyof UteReadings, number>>;
  issues: Issue[];
}

export interface CaravanBaseline {
  loads: CaravanLoads;
  source: CaravanBaselineSource;
  derived: Partial<Record<keyof CaravanReadings, number>>;
  issues: Issue[];
}

export type CheckGroup = 'Vehicle' | 'Tyres' | 'Towing' | 'Caravan';
export type CheckStatus = 'ok' | 'near' | 'over' | 'unset' | 'warn';

export interface Check {
  id: string;
  group: CheckGroup;
  label: string;
  value: number;
  limit: number | null;
  unit: 'kg' | '%';
  status: CheckStatus;
  detail?: string;
  /** Guidance rather than a rated limit; never shown as "over". */
  advisory?: boolean;
  /** Lower bound for advisory ranges. */
  min?: number;
}

export interface ItemEffect {
  ute: WheelLoads;
  caravan: CaravanLoads;
}

export interface CaravanResult {
  baseline: CaravanBaseline;
  items: CaravanLoads;
  /** Static loads (no WDH). ball + left + right = caravan mass. */
  loads: CaravanLoads;
  mass: number;
  /** Axle group load while hitched, including the WDH transfer. */
  axleLeft: number;
  axleRight: number;
  axle: number;
  ballPct: number;
}

export interface HitchResult {
  /** Static ball download without WDH. */
  ball: number;
  /** WDH couple in kg·mm. */
  wdhMoment: number;
  /** Vertical load the ute carries at the hitch once the WDH is tensioned. */
  netHitch: number;
  /** Load moved from the WDH onto the caravan axles. */
  wdhToCaravan: number;
  frontUnhitched: number;
  frontHitched: number;
  frontUnloadPct: number;
}

export interface UteResult {
  baseline: UteBaseline;
  items: WheelLoads;
  hitch: WheelLoads;
  unhitched: WheelLoads;
  total: WheelLoads;
  front: number;
  rear: number;
  gross: number;
  unhitchedGross: number;
}

export interface Headroom {
  gvm: number | null;
  frontAxle: number | null;
  rearAxle: number | null;
  /** Heaviest caravan the ute could tow as currently loaded. */
  maxCaravan: number | null;
  maxCaravanBy: string | null;
  gcm: number | null;
}

export interface Result {
  ute: UteResult;
  caravan: CaravanResult | null;
  hitch: HitchResult | null;
  checks: Check[];
  issues: Issue[];
  itemEffects: Record<string, ItemEffect>;
  headroom: Headroom;
}

export const zeroWheels = (): WheelLoads => ({ fl: 0, fr: 0, rl: 0, rr: 0 });
export const zeroCaravan = (): CaravanLoads => ({ ball: 0, left: 0, right: 0 });

function addWheels(a: WheelLoads, b: WheelLoads, k = 1): WheelLoads {
  return { fl: a.fl + k * b.fl, fr: a.fr + k * b.fr, rl: a.rl + k * b.rl, rr: a.rr + k * b.rr };
}

function addCaravan(a: CaravanLoads, b: CaravanLoads, k = 1): CaravanLoads {
  return { ball: a.ball + k * b.ball, left: a.left + k * b.left, right: a.right + k * b.right };
}

export function tolerance(value: number, s: CheckSettings): number {
  return Math.max(s.tolAbs, (Math.abs(value) * s.tolPct) / 100);
}

function clean(v: number | null | undefined): number | null {
  return v != null && Number.isFinite(v) && v > 0 ? v : null;
}

/** Load a point mass puts on each ute wheel. Works for positions ahead of the front axle or behind the rear one. */
export function uteShare(mass: number, p: Vec3, ute: UteSpec): WheelLoads {
  const rearFrac = p.x / ute.wheelbase;
  const front = mass * (1 - rearFrac);
  const rear = mass * rearFrac;
  const lf = p.y / ute.trackFront;
  const lr = p.y / ute.trackRear;
  return {
    fl: front * (0.5 - lf),
    fr: front * (0.5 + lf),
    rl: rear * (0.5 - lr),
    rr: rear * (0.5 + lr),
  };
}

/** Load a point mass puts on the tow ball and on each side of the caravan axle group. */
export function caravanShare(mass: number, p: Vec3, cv: CaravanSpec): CaravanLoads {
  const axle = (mass * p.x) / axleCentre(cv);
  const l = p.y / cv.track;
  return { ball: mass - axle, left: axle * (0.5 - l), right: axle * (0.5 + l) };
}

const UTE_LABEL: Record<keyof UteReadings, string> = {
  total: 'Total',
  front: 'Front axle',
  rear: 'Rear axle',
  fl: 'Front left wheel',
  fr: 'Front right wheel',
  rl: 'Rear left wheel',
  rr: 'Rear right wheel',
};

const CARAVAN_LABEL: Record<keyof CaravanReadings, string> = {
  total: 'Caravan total',
  ball: 'Ball weight',
  axle: 'Axle group',
  left: 'Left side',
  right: 'Right side',
};

function positivity<T extends object>(
  r: T,
  labels: Record<keyof T, string>,
  prefix: string,
  issues: Issue[],
) {
  for (const key of Object.keys(labels) as (keyof T)[]) {
    const v = r[key] as unknown as number | null;
    if (v != null && !(Number.isFinite(v) && v > 0)) {
      issues.push({
        level: 'error',
        message: `${labels[key]} must be greater than zero; the reading is ignored.`,
        fields: [`${prefix}.${String(key)}`],
      });
    }
  }
}

function mismatch(
  issues: Issue[],
  s: CheckSettings,
  what: string,
  sum: number,
  reading: number,
  fields: string[],
) {
  const diff = sum - reading;
  if (Math.abs(diff) > tolerance(Math.max(sum, reading), s)) {
    issues.push({
      level: 'warn',
      message: `${what}: ${kg(sum)} vs ${kg(reading)} (${signedKg(diff)}), more than the ±${num(tolerance(Math.max(sum, reading), s))} kg tolerance. Re-check the readings.`,
      fields,
    });
  }
}

function sideBalance(
  issues: Issue[],
  what: string,
  left: number,
  right: number,
  fields: string[],
) {
  const mean = (left + right) / 2;
  if (mean <= 0) return;
  const diffPct = (Math.abs(left - right) / mean) * 100;
  if (diffPct > 10) {
    issues.push({
      level: 'warn',
      message: `${what} left/right differ by ${pct(diffPct)} (${kg(left)} vs ${kg(right)}). More than about 10% is unusual: check the scales and that the ground was level.`,
      fields,
    });
  }
}

/** Splits an axle load into wheels, using whichever wheel readings exist. */
function splitAxle<K extends string>(
  axle: number,
  a: number | null,
  b: number | null,
  aKey: K,
  bKey: K,
  derived: Partial<Record<K, number>>,
  issues: Issue[],
  label: string,
  prefix: string,
): [number, number] {
  if (a != null && b != null) return [a, b];
  if (a != null || b != null) {
    const known = (a ?? b)!;
    const other = axle - known;
    derived[a != null ? bKey : aKey] = other;
    if (other < 0) {
      issues.push({
        level: 'error',
        message: `${label}: the single wheel reading (${kg(known)}) is more than the whole axle (${kg(axle)}).`,
        fields: [`${prefix}.${aKey}`, `${prefix}.${bKey}`],
      });
    }
    return a != null ? [a, other] : [other, b!];
  }
  derived[aKey] = axle / 2;
  derived[bKey] = axle / 2;
  return [axle / 2, axle / 2];
}

export function deriveUteBaseline(r: UteReadings, ute: UteSpec, s: CheckSettings): UteBaseline {
  const issues: Issue[] = [];
  const derived: UteBaseline['derived'] = {};
  positivity(r, UTE_LABEL, 'uteReadings', issues);
  const v = {
    total: clean(r.total),
    front: clean(r.front),
    rear: clean(r.rear),
    fl: clean(r.fl),
    fr: clean(r.fr),
    rl: clean(r.rl),
    rr: clean(r.rr),
  };

  for (const k of ['fl', 'fr', 'rl', 'rr'] as const) {
    if (v[k] != null && v[k]! > 2500) {
      issues.push({ level: 'warn', message: `${UTE_LABEL[k]} reads ${kg(v[k]!)}, very heavy for one wheel. Check the reading and units.`, fields: [`uteReadings.${k}`] });
    }
  }
  for (const k of ['front', 'rear'] as const) {
    if (v[k] != null && v[k]! > 4500) {
      issues.push({ level: 'warn', message: `${UTE_LABEL[k]} reads ${kg(v[k]!)}, very heavy for one ute axle. Check the reading and units.`, fields: [`uteReadings.${k}`] });
    }
  }

  const frontWheels = v.fl != null && v.fr != null ? v.fl + v.fr : null;
  const rearWheels = v.rl != null && v.rr != null ? v.rl + v.rr : null;
  const frontMeasured = frontWheels ?? v.front;
  const rearMeasured = rearWheels ?? v.rear;
  if (v.front == null && frontWheels != null) derived.front = frontWheels;
  if (v.rear == null && rearWheels != null) derived.rear = rearWheels;
  let front = frontMeasured;
  let rear = rearMeasured;
  let source: UteBaselineSource =
    frontWheels != null && rearWheels != null ? 'wheels' : 'axles';
  const share = Math.min(Math.max(ute.kerbFrontPct, 1), 99) / 100;

  if (front == null && rear != null && v.total != null) {
    front = v.total - rear;
    derived.front = front;
  } else if (rear == null && front != null && v.total != null) {
    rear = v.total - front;
    derived.rear = rear;
  }

  if (front == null && rear == null) {
    const total = v.total ?? ute.limits.kerb ?? 0;
    source = v.total != null ? 'partial' : 'spec';
    front = total * share;
    rear = total - front;
    derived.front = front;
    derived.rear = rear;
    if (v.total == null) derived.total = total;
    issues.push({
      level: 'info',
      message:
        v.total != null
          ? `Only the total was measured, so the front/rear split assumes the kerb weight distribution (${pct(share * 100)} front). Weigh each axle for real numbers.`
          : `Not weighed yet: using the published kerb weight (${kg(total)}) with an assumed ${pct(share * 100)} front split. Enter your weighbridge readings.`,
    });
  } else if (front == null || rear == null) {
    source = 'partial';
    if (front == null) {
      front = (rear! * share) / (1 - share);
      derived.front = front;
    } else {
      rear = (front * (1 - share)) / share;
      derived.rear = rear;
    }
    issues.push({
      level: 'warn',
      message: `Only one axle is known; the other is estimated from the kerb weight split (${pct(share * 100)} front). Add the total or the other axle.`,
    });
  }

  if (v.total == null && derived.total === undefined) derived.total = front! + rear!;

  const [fl, fr] = splitAxle(front!, v.fl, v.fr, 'fl', 'fr', derived, issues, 'Front axle', 'uteReadings');
  const [rl, rr] = splitAxle(rear!, v.rl, v.rr, 'rl', 'rr', derived, issues, 'Rear axle', 'uteReadings');

  if (frontWheels != null && v.front != null) {
    mismatch(issues, s, 'Front wheels (FL + FR) vs front axle', frontWheels, v.front, ['uteReadings.fl', 'uteReadings.fr', 'uteReadings.front']);
  }
  if (rearWheels != null && v.rear != null) {
    mismatch(issues, s, 'Rear wheels (RL + RR) vs rear axle', rearWheels, v.rear, ['uteReadings.rl', 'uteReadings.rr', 'uteReadings.rear']);
  }
  if (frontMeasured != null && rearMeasured != null && v.total != null) {
    mismatch(issues, s, 'Front + rear axle vs total', frontMeasured + rearMeasured, v.total, ['uteReadings.front', 'uteReadings.rear', 'uteReadings.total']);
  }
  if (v.fl != null && v.fr != null) sideBalance(issues, 'Front axle', v.fl, v.fr, ['uteReadings.fl', 'uteReadings.fr']);
  if (v.rl != null && v.rr != null) sideBalance(issues, 'Rear axle', v.rl, v.rr, ['uteReadings.rl', 'uteReadings.rr']);

  const gross = front! + rear!;
  if (source === 'wheels' || source === 'axles') {
    const frontPct = (front! / gross) * 100;
    if (frontPct < 38 || frontPct > 68) {
      issues.push({
        level: 'warn',
        message: `The front axle carries ${pct(frontPct)} of the measured weight. Utes usually sit between about 40% and 65%; check the readings.`,
        fields: ['uteReadings.front', 'uteReadings.rear'],
      });
    }
    const kerb = ute.limits.kerb;
    if (kerb && gross < kerb * 0.95) {
      issues.push({
        level: 'warn',
        message: `Measured ${kg(gross)} is less than the published kerb weight (${kg(kerb)}). Kerb weight includes a full tank; check the readings.`,
        fields: ['uteReadings.total'],
      });
    }
  }

  return { wheels: { fl, fr, rl, rr }, source, derived, issues };
}

export function deriveCaravanBaseline(
  r: CaravanReadings,
  cv: CaravanSpec,
  s: CheckSettings,
): CaravanBaseline {
  const issues: Issue[] = [];
  const derived: CaravanBaseline['derived'] = {};
  positivity(r, CARAVAN_LABEL, 'caravanReadings', issues);
  const v = {
    total: clean(r.total),
    ball: clean(r.ball),
    axle: clean(r.axle),
    left: clean(r.left),
    right: clean(r.right),
  };

  const sides = v.left != null && v.right != null ? v.left + v.right : null;
  const axleMeasured = sides ?? v.axle;
  if (v.axle == null && sides != null) derived.axle = sides;
  let axle = axleMeasured;
  let ball = v.ball;
  let source: CaravanBaselineSource = 'measured';

  if (axle == null && ball != null && v.total != null) {
    axle = v.total - ball;
    derived.axle = axle;
  } else if (ball == null && axle != null && v.total != null) {
    ball = v.total - axle;
    derived.ball = ball;
  }

  if (ball == null || axle == null) {
    const tare = clean(cv.limits.tare);
    const tareBall = clean(cv.limits.tareBall);
    const ratio = tare && tareBall ? tareBall / tare : 0.1;
    const ratioText = tare && tareBall ? `the tare ball ratio (${pct(ratio * 100)})` : 'a typical 10%';
    if (ball == null && axle == null && v.total == null) {
      source = 'spec';
      const total = tare ?? 0;
      ball = tareBall ?? total * ratio;
      axle = total - ball;
      derived.total = total;
      issues.push({
        level: 'info',
        message: `Caravan not weighed yet: using the plated tare (${kg(total)}) and tare ball weight (${kg(ball)}). Add your weighbridge and ball scale readings.`,
      });
    } else {
      source = 'partial';
      if (v.total != null) {
        ball = v.total * ratio;
        axle = v.total - ball;
        issues.push({ level: 'warn', message: `Only the caravan total is known, so the ball weight assumes ${ratioText}. Measure it with a tow ball scale.`, fields: ['caravanReadings.ball'] });
      } else if (ball != null) {
        axle = ball / ratio - ball;
        issues.push({ level: 'warn', message: `Only the ball weight is known, so the axle group load assumes ${ratioText}. Add the caravan total from a weighbridge.`, fields: ['caravanReadings.total'] });
      } else {
        ball = (axle! * ratio) / (1 - ratio);
        issues.push({ level: 'warn', message: `Only the axle group is known, so the ball weight assumes ${ratioText}. Measure it with a tow ball scale.`, fields: ['caravanReadings.ball'] });
      }
      if (v.ball == null) derived.ball = ball;
      if (axleMeasured == null) derived.axle = axle!;
    }
  }
  if (v.total == null && derived.total === undefined) derived.total = ball + axle!;

  const [left, right] = splitAxle(axle!, v.left, v.right, 'left', 'right', derived, issues, 'Caravan axle group', 'caravanReadings');

  if (sides != null && v.axle != null) {
    mismatch(issues, s, 'Caravan left + right vs axle group', sides, v.axle, ['caravanReadings.left', 'caravanReadings.right', 'caravanReadings.axle']);
  }
  if (v.ball != null && axleMeasured != null && v.total != null) {
    mismatch(issues, s, 'Ball weight + axle group vs caravan total', v.ball + axleMeasured, v.total, ['caravanReadings.ball', 'caravanReadings.axle', 'caravanReadings.total']);
  }
  if (v.left != null && v.right != null) sideBalance(issues, 'Caravan axle group', v.left, v.right, ['caravanReadings.left', 'caravanReadings.right']);

  const total = ball + axle!;
  if (source === 'measured' && total > 0) {
    const bp = (ball / total) * 100;
    if (bp < 4 || bp > 20) {
      issues.push({
        level: 'warn',
        message: `The measured ball weight is ${pct(bp)} of the caravan mass, well outside the usual 8–12%. Check the readings.`,
        fields: ['caravanReadings.ball'],
      });
    }
    const tare = cv.limits.tare;
    if (tare && total < tare * 0.95) {
      issues.push({
        level: 'warn',
        message: `Measured ${kg(total)} is less than the plated tare (${kg(tare)}). Check the readings.`,
        fields: ['caravanReadings.total'],
      });
    }
  }

  return { loads: { ball, left, right }, source, derived, issues };
}

function limitStatus(value: number, limit: number | null, s: CheckSettings): CheckStatus {
  if (limit == null || !(limit > 0)) return 'unset';
  if (value > limit + 1e-6) return 'over';
  if (value >= (limit * s.nearPct) / 100) return 'near';
  return 'ok';
}

function limitCheck(
  s: CheckSettings,
  id: string,
  group: CheckGroup,
  label: string,
  value: number,
  limit: number | null,
  detail?: string,
): Check {
  return { id, group, label, value, limit, unit: 'kg', status: limitStatus(value, limit, s), detail };
}

function minOf(...values: (number | null | undefined)[]): number | null {
  const real = values.filter((x): x is number => x != null && x > 0);
  return real.length ? Math.min(...real) : null;
}

export function compute(setup: Setup): Result {
  const { ute, hitch, caravan: cv, settings: s } = setup;
  const towing = setup.towing;
  const issues: Issue[] = [];

  const uteBase = deriveUteBaseline(setup.uteReadings, ute, s);
  issues.push(...uteBase.issues);
  const cvBase = towing ? deriveCaravanBaseline(setup.caravanReadings, cv, s) : null;
  if (cvBase) issues.push(...cvBase.issues);

  let uteItems = zeroWheels();
  let cvItems = zeroCaravan();
  const itemEffects: Record<string, ItemEffect> = {};
  let ignored = 0;

  const effectOf = (host: Host, pos: Vec3, mass: number, effect: ItemEffect) => {
    if (host === 'ute') {
      effect.ute = addWheels(effect.ute, uteShare(mass, pos, ute));
    } else if (towing) {
      effect.caravan = addCaravan(effect.caravan, caravanShare(mass, pos, cv));
    } else {
      return false;
    }
    return true;
  };

  for (const item of setup.items) {
    const effect: ItemEffect = { ute: zeroWheels(), caravan: zeroCaravan() };
    if (item.mass > 0) {
      let counted = true;
      if (item.enabled) counted = effectOf(item.host, item.pos, item.mass, effect) && counted;
      if (item.measured) counted = effectOf(item.measured.host, item.measured.pos, -item.mass, effect) && counted;
      if (!counted) ignored++;
    }
    itemEffects[item.id] = effect;
    uteItems = addWheels(uteItems, effect.ute);
    cvItems = addCaravan(cvItems, effect.caravan);
  }
  if (ignored) {
    issues.push({
      level: 'info',
      message: `${ignored} caravan item${ignored === 1 ? ' is' : 's are'} ignored because towing is switched off.`,
    });
  }

  const unhitched = addWheels(uteBase.wheels, uteItems);
  const unhitchedGross = unhitched.fl + unhitched.fr + unhitched.rl + unhitched.rr;
  const frontUnhitched = unhitched.fl + unhitched.fr;

  let hitchLoads = zeroWheels();
  let caravanResult: CaravanResult | null = null;
  let hitchResult: HitchResult | null = null;

  if (towing && cvBase) {
    const loads = addCaravan(cvBase.loads, cvItems);
    const mass = loads.ball + loads.left + loads.right;
    const B = loads.ball;
    const L = ute.wheelbase;
    const d = hitch.ballOffset;
    const a = axleCentre(cv);

    if (cv.axles.length === 2) {
      const spacing = Math.abs(cv.axles[1] - cv.axles[0]);
      const tyre = tyreDiameter(cv.tyre.size);
      if (tyre && spacing < tyre + 20) {
        issues.push({
          level: 'warn',
          message: `The caravan axles are ${mm(spacing)} apart, less than a tyre diameter (${mm(tyre)}): the wheels would touch. Check the axle distances from the tow ball.`,
          fields: ['caravan.axles.0', 'caravan.axles.1'],
        });
      }
    }

    if (B < 0) {
      issues.push({
        level: 'error',
        message: `The ball weight is negative (${kg(B)}): the caravan is tail-heavy and lifts the tow ball. This is dangerous; move weight forward.`,
      });
    }

    // A WDH couple M at the hitch moves M/L from the rear to the front axle
    // and M/a from the hitch onto the caravan axles. M is chosen so the front
    // axle regains the requested share of the load the ball weight took off it.
    const restore = hitch.wdh.enabled ? Math.min(Math.max(hitch.wdh.restorePct, 0), 150) / 100 : 0;
    const M = B > 0 ? (restore * B * d * a) / (d + a) : 0;
    const netHitch = B - M / a;
    const frontDelta = (-netHitch * d) / L + M / L;
    const rearDelta = (netHitch * (L + d)) / L - M / L;
    hitchLoads = { fl: frontDelta / 2, fr: frontDelta / 2, rl: rearDelta / 2, rr: rearDelta / 2 };

    const axleLeft = loads.left + M / a / 2;
    const axleRight = loads.right + M / a / 2;
    caravanResult = {
      baseline: cvBase,
      items: cvItems,
      loads,
      mass,
      axleLeft,
      axleRight,
      axle: axleLeft + axleRight,
      ballPct: mass > 0 ? (B / mass) * 100 : 0,
    };
    const frontHitched = frontUnhitched + frontDelta;
    hitchResult = {
      ball: B,
      wdhMoment: M,
      netHitch,
      wdhToCaravan: M / a,
      frontUnhitched,
      frontHitched,
      frontUnloadPct: frontUnhitched > 0 ? ((frontUnhitched - frontHitched) / frontUnhitched) * 100 : 0,
    };
    if (hitch.wdh.enabled) {
      issues.push({
        level: 'info',
        message: 'Weight distribution hitch on: check that your vehicle and tow bar manufacturers approve WDH use, and the setting they specify.',
      });
    }
  }

  const total = addWheels(unhitched, hitchLoads);
  const front = total.fl + total.fr;
  const rear = total.rl + total.rr;
  const gross = front + rear;
  const lim = ute.limits;

  const checks: Check[] = [];
  checks.push(
    limitCheck(s, 'gvm', 'Vehicle', 'Gross vehicle mass (GVM)', gross, lim.gvm,
      hitchResult ? `Includes ${kg(hitchResult.netHitch)} carried at the tow ball.` : undefined),
    limitCheck(s, 'frontAxle', 'Vehicle', 'Front axle', front, lim.frontAxle),
    limitCheck(s, 'rearAxle', 'Vehicle', 'Rear axle', rear, lim.rearAxle),
  );
  if (lim.kerb) {
    checks.push(limitCheck(s, 'payload', 'Vehicle', 'Payload (mass above kerb)', gross - lim.kerb, lim.payload,
      `Current mass ${kg(gross)} minus kerb ${kg(lim.kerb)}.`));
  }
  const tyreKg = loadIndexKg(ute.tyre.loadIndex);
  for (const w of WHEEL_IDS) {
    checks.push(limitCheck(s, `tyre_${w}`, 'Tyres', `${WHEEL_NAMES[w]} tyre`, total[w], tyreKg,
      tyreKg ? `Load index ${ute.tyre.loadIndex} = ${kg(tyreKg)} per tyre.` : 'Enter the tyre load index.'));
  }

  if (caravanResult && hitchResult) {
    const c = caravanResult;
    const B = hitchResult.ball;
    const towCap = cv.hasBrakes ? lim.brakedTow : lim.unbrakedTow;
    checks.push(
      limitCheck(s, 'towCapacity', 'Towing', cv.hasBrakes ? 'Caravan mass vs braked towing capacity' : 'Caravan mass vs unbraked towing capacity', c.mass, towCap),
      limitCheck(s, 'towBall', 'Towing', 'Tow ball download', B, lim.towBallMax,
        hitch.wdh.enabled ? `Static ball weight. With the WDH tensioned the ute carries ${kg(hitchResult.netHitch)} at the hitch.` : undefined),
    );
    if (hitch.towbarRating) checks.push(limitCheck(s, 'towbarRating', 'Towing', 'Caravan mass vs tow bar rating', c.mass, hitch.towbarRating));
    if (hitch.towbarBallRating) checks.push(limitCheck(s, 'towbarBall', 'Towing', 'Ball download vs tow bar rating', B, hitch.towbarBallRating));
    checks.push(limitCheck(s, 'gcm', 'Towing', 'Gross combination mass (GCM)', unhitchedGross + c.mass, lim.gcm,
      `Ute ${kg(unhitchedGross)} + caravan ${kg(c.mass)}.`));
    checks.push({
      id: 'ballPct',
      group: 'Towing',
      label: 'Ball weight share of caravan mass',
      value: c.ballPct,
      limit: s.ballPctMax,
      min: s.ballPctMin,
      unit: '%',
      advisory: true,
      status: c.ballPct >= s.ballPctMin && c.ballPct <= s.ballPctMax ? 'ok' : 'warn',
      detail: c.ballPct < s.ballPctMin
        ? `Below ${pct(s.ballPctMin)} the combination is more prone to sway.`
        : c.ballPct > s.ballPctMax
          ? `Above ${pct(s.ballPctMax)} the ute's rear is heavily loaded and the front unloaded.`
          : `Guideline ${pct(s.ballPctMin)}–${pct(s.ballPctMax)}.`,
    });
    checks.push({
      id: 'frontUnload',
      group: 'Towing',
      label: 'Front axle unloading when hitched',
      value: hitchResult.frontUnloadPct,
      limit: s.frontUnloadPct,
      unit: '%',
      advisory: true,
      status: hitchResult.frontUnloadPct <= s.frontUnloadPct ? 'ok' : 'warn',
      detail: `Front axle ${kg(hitchResult.frontUnhitched)} → ${kg(hitchResult.frontHitched)}${hitch.wdh.enabled ? ` with the WDH restoring ${pct(hitch.wdh.restorePct)}` : ''}. Less weight on the steering axle reduces grip for steering and braking.`,
    });
    checks.push(
      limitCheck(s, 'atm', 'Caravan', 'Caravan mass vs ATM', c.mass, cv.limits.atm),
      limitCheck(s, 'gtm', 'Caravan', 'Axle group vs GTM', c.axle, cv.limits.gtm,
        hitchResult.wdhToCaravan > 0 ? `Includes ${kg(hitchResult.wdhToCaravan)} moved by the WDH.` : undefined),
    );
    const cvTyreKg = loadIndexKg(cv.tyre.loadIndex);
    const n = cv.axles.length;
    checks.push(
      limitCheck(s, 'cvTyre_left', 'Caravan', `Caravan left tyre${n > 1 ? 's (each)' : ''}`, c.axleLeft / n, cvTyreKg),
      limitCheck(s, 'cvTyre_right', 'Caravan', `Caravan right tyre${n > 1 ? 's (each)' : ''}`, c.axleRight / n, cvTyreKg),
    );
    if (cv.limits.atm && towCap && cv.limits.atm > towCap) {
      checks.push({
        id: 'atmVsTow',
        group: 'Caravan',
        label: 'Plated ATM vs towing capacity',
        value: cv.limits.atm,
        limit: towCap,
        unit: 'kg',
        advisory: true,
        status: 'warn',
        detail: 'The caravan is rated to be loaded heavier than the ute may tow. The actual mass is what counts, but you can overload it without noticing.',
      });
    }
  }

  const towCap = cv.hasBrakes ? lim.brakedTow : lim.unbrakedTow;
  const gcmRoom = lim.gcm ? lim.gcm - unhitchedGross : null;
  const maxCaravan = minOf(towCap, gcmRoom, hitch.towbarRating);
  let maxCaravanBy: string | null = null;
  if (maxCaravan != null) {
    maxCaravanBy = maxCaravan === gcmRoom ? 'GCM minus the ute as loaded' : maxCaravan === hitch.towbarRating ? 'tow bar rating' : 'towing capacity';
  }

  return {
    ute: {
      baseline: uteBase,
      items: uteItems,
      hitch: hitchLoads,
      unhitched,
      total,
      front,
      rear,
      gross,
      unhitchedGross,
    },
    caravan: caravanResult,
    hitch: hitchResult,
    checks,
    issues,
    itemEffects,
    headroom: {
      gvm: lim.gvm ? lim.gvm - gross : null,
      frontAxle: lim.frontAxle ? lim.frontAxle - front : null,
      rearAxle: lim.rearAxle ? lim.rearAxle - rear : null,
      maxCaravan,
      maxCaravanBy,
      gcm: lim.gcm && caravanResult ? lim.gcm - unhitchedGross - caravanResult.mass : null,
    },
  };
}

export interface CapacityAt {
  /** Extra mass that fits at the position before the first rated limit is reached. */
  kg: number;
  limitedBy: string | null;
}

/** How much more mass could go at a position before any rated limit is exceeded. */
export function capacityAt(setup: Setup, host: Host, pos: Vec3, base: Result = compute(setup)): CapacityAt {
  const probe: LoadItem = {
    id: '__probe__',
    name: 'probe',
    mass: 1,
    size: { l: 1, w: 1, h: 1 },
    shape: 'box',
    color: '#000',
    host,
    pos,
    enabled: true,
    measured: null,
  };
  const withProbe = compute({ ...setup, items: [...setup.items, probe] });
  let best = Infinity;
  let limitedBy: string | null = null;
  for (const c of base.checks) {
    if (c.advisory || c.unit !== 'kg' || c.limit == null || !(c.limit > 0)) continue;
    const after = withProbe.checks.find((x) => x.id === c.id);
    if (!after) continue;
    const perKg = after.value - c.value;
    if (perKg <= 1e-6) continue;
    const room = Math.max(0, (c.limit - c.value) / perKg);
    if (room < best) {
      best = room;
      limitedBy = c.label;
    }
  }
  return { kg: best, limitedBy };
}

/** Worst check status, raised to "warn" when the readings themselves look wrong. */
export function overallStatus(result: Result): CheckStatus {
  const st = worstStatus(result.checks);
  const dataProblem = result.issues.some((i) => i.level !== 'info');
  return dataProblem && st !== 'over' ? 'warn' : st;
}

export function worstStatus(checks: Check[]): CheckStatus {
  const order: CheckStatus[] = ['over', 'warn', 'near', 'unset', 'ok'];
  for (const st of order) if (checks.some((c) => c.status === st)) return st;
  return 'ok';
}
