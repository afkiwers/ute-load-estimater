// Brings setups saved by earlier versions (browser storage or exported files)
// up to the current shape and fills in anything added since.

import type { Setup } from './types';
import { newSetup, uid, vehicleSpec } from './presets';
import { trailerPreset } from './trailers';

type Raw = Record<string, unknown>;

/**
 * Caravans used to store one coupling-to-axle-group distance plus an axle
 * count and spacing; they now store each axle's distance from the tow ball.
 */
function upgradeCaravanAxles(setup: Raw) {
  const cv = setup.caravan as Raw | undefined;
  if (!cv || Array.isArray(cv.axles) || typeof cv.couplingToAxle !== 'number') return;
  const centre = cv.couplingToAxle;
  const spacing = typeof cv.axleSpacing === 'number' ? cv.axleSpacing : 1000;
  cv.axles = cv.axleCount === 2 ? [centre - spacing / 2, centre + spacing / 2] : [centre];
  delete cv.couplingToAxle;
  delete cv.axleCount;
  delete cv.axleSpacing;
  if (Array.isArray(setup.placeholders)) {
    const old = new Set(['caravan.couplingToAxle', 'caravan.axleSpacing']);
    const had = (setup.placeholders as string[]).some((p) => old.has(p));
    setup.placeholders = (setup.placeholders as string[]).filter((p) => !old.has(p));
    if (had) (setup.placeholders as string[]).push(...(cv.axles as number[]).map((_, i) => `caravan.axles.${i}`));
  }
}

function upgradeSetup<T>(raw: T): T {
  const copy = structuredClone(raw) as Raw;
  upgradeCaravanAxles(copy);
  const cv = copy.caravan as Raw | undefined;
  if (cv && Array.isArray(cv.axles) && (cv.axles.length < 1 || cv.axles.length > 2)) delete cv.axles;
  // Saved before the weighed axle position was kept: take the readings as taken where the axles are.
  if (cv && Array.isArray(cv.axles) && !Array.isArray(cv.weighedAxles)) cv.weighedAxles = [...cv.axles];
  return copy as T;
}

/** Upgrades an old save and fills in fields added in later versions from the defaults. */
export function normalizeSetup(input: Partial<Setup>): Setup {
  const raw = upgradeSetup(input);
  const base = newSetup(raw.name ?? 'Imported setup');
  const merge = (def: unknown, val: unknown): unknown => {
    if (val === undefined) return def;
    if (def && typeof def === 'object' && !Array.isArray(def) && val && typeof val === 'object' && !Array.isArray(val)) {
      const out: Record<string, unknown> = { ...(val as Record<string, unknown>) };
      for (const [k, v] of Object.entries(def as Record<string, unknown>)) out[k] = merge(v, (val as Record<string, unknown>)[k]);
      return out;
    }
    return val;
  };
  const merged = merge(base, raw) as Setup;
  merged.items = (raw.items ?? []).map((it) => ({
    ...it,
    id: it.id ?? uid(),
    // The boat used to be added under a name that described one particular hull; it is just "Boat" now.
    name: it.templateId === 'boatHull' && it.name === OLD_BOAT_NAME ? 'Boat' : it.name,
  }));
  merged.placeholders = raw.placeholders ?? [];
  // Sizes the fields never allow at 0 or below (a hand-edited file) take the model's or trailer type's instead.
  const defaults = { ute: vehicleSpec(merged.ute.model), caravan: trailerPreset(merged.caravan.kind), hitch: base.hitch };
  for (const path of SIZES) {
    if (!(Number(getPath(merged, path)) > 0)) setPath(merged, path, getPath(defaults, path));
  }
  const axlesOk = (xs: unknown) => Array.isArray(xs) && xs.length >= 1 && xs.length <= 2 && xs.every((x) => Number(x) > 0);
  if (!axlesOk(merged.caravan.axles)) merged.caravan.axles = [...defaults.caravan.axles];
  if (!axlesOk(merged.caravan.weighedAxles)) merged.caravan.weighedAxles = [...merged.caravan.axles];
  return merged;
}

const OLD_BOAT_NAME = 'Boat hull, 5.3 m aluminium';

const SIZES = [
  'ute.wheelbase',
  'ute.trackFront',
  'ute.trackRear',
  'ute.overallLength',
  'ute.overallWidth',
  'ute.overallHeight',
  'ute.tub.length',
  'ute.tub.width',
  'ute.tub.depth',
  'ute.tub.floorHeight',
  'ute.kerbFrontPct',
  'hitch.ballHeight',
  'caravan.track',
  'caravan.bodyStart',
  'caravan.bodyLength',
  'caravan.bodyWidth',
  'caravan.bodyHeight',
  'caravan.floorHeight',
];

const getPath = (o: unknown, path: string) => path.split('.').reduce<unknown>((a, k) => (a as Raw | undefined)?.[k], o);
function setPath(o: unknown, path: string, v: unknown) {
  const keys = path.split('.');
  const last = keys.pop()!;
  (keys.reduce<unknown>((a, k) => (a as Raw)[k], o) as Raw)[last] = v;
}
