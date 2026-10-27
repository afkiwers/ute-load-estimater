// Brings setups saved by earlier versions (browser storage or exported files)
// up to the current shape and fills in anything added since.

import type { Setup } from './types';
import { newSetup, uid } from './presets';

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
  merged.items = (raw.items ?? []).map((it) => ({ ...it, id: it.id ?? uid() }));
  merged.placeholders = raw.placeholders ?? [];
  return merged;
}
