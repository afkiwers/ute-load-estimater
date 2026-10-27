import { describe, expect, it } from 'vitest';
import { compute } from './calc';
import { ITEM_TEMPLATES, itemFromTemplate, newSetup } from './presets';
import { normalizeSetup } from './migrate';
import { trailerPreset } from './trailers';
import type { Setup } from './types';

// Every field a person can edit must change the results somewhere, unless it only names or
// draws something. A new field that is never wired into the calculation fails here.

const DRAW_OR_NAME_ONLY = [
  'name',
  'ute.model',
  'ute.name',
  'ute.overallLength',
  'ute.overallWidth',
  'ute.overallHeight',
  'ute.frontOverhang',
  'ute.tub.length',
  'ute.tub.width',
  'ute.tub.depth',
  'ute.tub.floorHeight',
  'ute.tyre.size',
  'ute.paint',
  'hitch.ballHeight',
  'caravan.name',
  'caravan.bodyStart',
  'caravan.bodyLength',
  'caravan.bodyWidth',
  'caravan.bodyHeight',
  'caravan.floorHeight',
];

/** Editable leaves of a setup as dotted paths. Items are edited in their own panel. */
function fields(obj: unknown, prefix = ''): string[] {
  if (obj === null || typeof obj !== 'object') return [prefix];
  return Object.entries(obj as Record<string, unknown>).flatMap(([k, v]) => {
    if (['items', 'id', 'placeholders', 'updatedAt', 'weighedAxles'].includes(k)) return [];
    const p = prefix ? `${prefix}.${k}` : k;
    return v === null ? [p] : fields(v, p);
  });
}

const get = (o: unknown, path: string) => path.split('.').reduce<any>((a, k) => a?.[k], o);
function set(o: unknown, path: string, v: unknown) {
  const keys = path.split('.');
  const last = keys.pop()!;
  keys.reduce<any>((a, k) => a[k], o)[last] = v;
}

function another(v: unknown, path: string): unknown {
  if (typeof v === 'boolean') return !v;
  if (typeof v === 'number') return Math.round(v * 1.13 + 37);
  if (path === 'caravan.kind') return v === 'boat' ? 'caravan' : 'boat';
  if (path.endsWith('tyre.size')) return '285/75R16';
  if (typeof v === 'string') return `${v}x`;
  return 150; // not entered yet
}

/** Towing with items on the ute and the trailer, some off-centre. */
function loaded(): Setup {
  const s = newSetup();
  s.towing = true;
  s.hitch.wdh.enabled = true;
  s.hitch.towbarRating = 3300;
  s.hitch.towbarBallRating = 330;
  const fridge = ITEM_TEMPLATES.find((t) => t.id === 'fridge')!;
  s.items.push({ ...itemFromTemplate(fridge, s), pos: { x: 3700, y: 400, z: 1100 } });
  s.items.push({ ...itemFromTemplate(fridge, s), host: 'caravan', pos: { x: 3000, y: 300, z: 900 } });
  return s;
}

const SCENARIOS: Record<string, () => Setup> = {
  'not weighed': loaded,
  weighed: () => {
    const s = loaded();
    s.uteReadings = { total: 2600, front: 1420, rear: 1180, fl: 705, fr: 715, rl: 585, rr: 595 };
    s.caravanReadings = { total: 2500, ball: 240, axle: 2260, axleFront: 1120, axleRear: 1140, left: 1125, right: 1135 };
    return s;
  },
  // Unbraked trailer, readings that disagree, a limit nearly reached and tandem axles too close.
  'edge cases': () => {
    const s = loaded();
    s.caravan.hasBrakes = false;
    s.uteReadings = { ...s.uteReadings, front: 1480, rear: 1180, total: 2600 };
    s.caravan.axles = [4950, 5650];
    s.caravan.weighedAxles = [4950, 5650];
    // GVM 97% used, so moving the "near" threshold changes its status.
    s.ute.limits.gvm = Math.round(compute(s).checks.find((c) => c.id === 'gvm')!.value / 0.97);
    return s;
  },
};

describe('inputs', () => {
  it('every field changes the results, unless it only names or draws something', () => {
    const unused = fields(newSetup()).filter((path) =>
      Object.values(SCENARIOS).every((make) => {
        const s = make();
        const before = JSON.stringify(compute(s));
        set(s, path, another(get(s, path), path));
        return JSON.stringify(compute(s)) === before;
      }),
    );
    expect(unused.sort()).toEqual([...DRAW_OR_NAME_ONLY].sort());
  });

  it('survives every field at 0, empty, negative or huge', () => {
    const broken: string[] = [];
    for (const [name, make] of Object.entries(SCENARIOS)) {
      for (const path of fields(newSetup())) {
        for (const value of [0, null, -1, 1e9]) {
          const s = make();
          if (typeof get(s, path) === 'string' || typeof get(s, path) === 'boolean') continue;
          set(s, path, value);
          if (/NaN|Infinity|∞/.test(JSON.stringify(compute(s)))) broken.push(`${path} = ${value} (${name})`);
        }
      }
    }
    expect([...new Set(broken)]).toEqual([]);
  });

  it('replaces impossible sizes in an imported file with the model and trailer type ones', () => {
    const file = structuredClone(SCENARIOS.weighed()) as any;
    file.ute.wheelbase = 0;
    file.ute.trackFront = null;
    file.caravan.kind = 'boat';
    file.caravan.track = -5;
    file.caravan.axles = [0];
    delete file.caravan.weighedAxles;
    const s = normalizeSetup(file);
    expect(s.ute.wheelbase).toBe(3350);
    expect(s.ute.trackFront).toBe(1635);
    expect(s.caravan.track).toBe(trailerPreset('boat').track);
    expect(s.caravan.axles).toEqual(trailerPreset('boat').axles);
    expect(s.caravan.weighedAxles).toEqual(s.caravan.axles);
    expect(JSON.stringify(compute(s))).not.toMatch(/NaN|Infinity/);
  });
});
