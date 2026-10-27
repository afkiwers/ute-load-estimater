// The ute's rounded body, described as cross-sections along its length and
// lofted into smooth surfaces. Everything scales with the entered dimensions.

import * as THREE from 'three';
import type { UteGeometry } from '../model/geometry';
import { loft, stationsBetween, type Pt, type Station } from './loft';

export interface Section {
  /** Bottom and top of the body side at this station (mm). */
  z0: number;
  z1: number;
  /** Half-width at the widest point, and how much the side leans in towards the top. */
  half: number;
  lean: number;
  /** Corner radii at the shoulder (top) and the sill (bottom). */
  rt: number;
  rb: number;
  /** Rise of the top's centre above its edges. */
  crown: number;
}

export const PAINT = 0;
export const TRIM = 1;
export const GLASS = 2;

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const clamp01 = (t: number) => Math.min(1, Math.max(0, t));
const smooth = (t: number) => {
  const u = clamp01(t);
  return u * u * (3 - 2 * u);
};
/** How far a rounded corner of radius r has curved away, d into it. */
const curl = (r: number, d: number) => r - Math.sqrt(Math.max(0, r * r - Math.min(d, r) ** 2));
const softMin = (a: number, b: number, k: number) => -k * Math.log(Math.exp(-a / k) + Math.exp(-b / k));

function arc(cy: number, cz: number, r: number, from: number, to: number, steps: number): Pt[] {
  const pts: Pt[] = [];
  for (let i = 1; i <= steps; i++) {
    const a = from + ((to - from) * i) / steps;
    pts.push([cy + r * Math.cos(a), cz + r * Math.sin(a)]);
  }
  return pts;
}

function line(a: Pt, b: Pt, steps: number): Pt[] {
  const pts: Pt[] = [];
  for (let i = 1; i <= steps; i++) pts.push([lerp(a[0], b[0], i / steps), lerp(a[1], b[1], i / steps)]);
  return pts;
}

/** Right half of a body section, from the bottom centre round to the start of the top. */
function outerSide(sec: Section): Pt[] {
  const { z0, z1, half, lean, rt, rb } = sec;
  const pts: Pt[] = [[0, z0], ...line([0, z0], [half - rb, z0], 2)];
  pts.push(...arc(half - rb, z0 + rb, rb, -Math.PI / 2, 0, 4));
  pts.push(...line([half, z0 + rb], [half - lean, z1 - rt], 4));
  pts.push(...arc(half - lean - rt, z1 - rt, rt, 0, Math.PI / 2, 8));
  return pts;
}

/** Half-width of a section's outline at height z (negative outside its height). */
function widthAt(sec: Section, z: number): number {
  const { z0, z1, half, lean, rt, rb } = sec;
  if (z < z0 || z > z1) return -1;
  if (z > z1 - rt) return half - lean - rt + Math.sqrt(Math.max(0, rt * rt - (z - (z1 - rt)) ** 2));
  if (z < z0 + rb) return half - rb + Math.sqrt(Math.max(0, rb * rb - (z0 + rb - z) ** 2));
  return half - lean * clamp01((z - (z0 + rb)) / (z1 - rt - (z0 + rb)));
}

const mirror = (pts: Pt[]): Pt[] => pts.map(([y, z]) => [-y, z] as Pt).reverse();

/** Closed section: rounded sides and a crowned top. */
function closedRing(sec: Section): Pt[] {
  const side = outerSide(sec);
  const topHalf = sec.half - sec.lean - sec.rt;
  const top: Pt[] = [];
  for (let i = 1; i <= 4; i++) {
    const y = topHalf * (1 - i / 4);
    top.push([y, sec.z1 + sec.crown * (1 - (y / topHalf) ** 2)]);
  }
  const right = [...side, ...top];
  return [...right, ...mirror(right).slice(1)];
}

/** Tub section: rounded outer skin, rails, inner walls and floor, as separate shading zones. */
function tubZones(sec: Section, inner: number, floor: number): Pt[][] {
  const ri = 18;
  const zf = Math.max(floor, sec.z0 + 15);
  const outer = [...outerSide(sec), ...line([sec.half - sec.lean - sec.rt, sec.z1], [inner + ri, sec.z1], 2)];
  const wall: Pt[] = [[inner + ri, sec.z1], ...arc(inner + ri, sec.z1 - ri, ri, Math.PI / 2, Math.PI, 3), ...line([inner, sec.z1 - ri], [inner, zf], 3)];
  const bed: Pt[] = [[inner, zf], ...line([inner, zf], [-inner, zf], 6)];
  return [outer, wall, bed, mirror(wall), mirror(outer)];
}

export interface UteShape {
  section: (s: number) => Section;
  topZ: (s: number) => number;
  /** Body side at height z (y of the outer skin, before flares). */
  sideY: (s: number, z: number) => number;
  /** Front surface (x) at lateral y and height z. */
  frontX: (y: number, z: number) => number;
  body: THREE.BufferGeometry[];
  greenhouse: THREE.BufferGeometry;
  archR: number;
}

export function makeUteShape(g: UteGeometry): UteShape {
  const H0 = g.bodyW / 2;
  const zb = g.bumperBottom;
  const sF = g.sFront;
  const sR = g.sRear;
  const archR = Math.max(g.wheelR + 10, Math.min(g.wheelR + 55, g.tubFloor - 80 - g.wheelR));
  const arches = [0, g.L];
  // Corner radii: front corners in plan, the bonnet nose, the chin, and the same at the rear.
  const Rc = 230;
  const Rv = 140;
  const Rch = 100;
  const RcR = 50;
  const RvR = 50;
  const RchR = 120;
  const rise = Math.max(80, (g.zBelt - g.zCowl) * 1.15);

  const planHalf = (s: number) => {
    let h = H0;
    if (s < sF + Rc) h -= curl(Rc, sF + Rc - s);
    if (s > sR - RcR) h -= curl(RcR, s - (sR - RcR));
    // Wheel arches swell out like flares.
    for (const cx of arches) {
      const d = Math.abs(s - cx) / (archR + 260);
      if (d < 1) h += 26 * Math.cos((d * Math.PI) / 2) ** 2;
    }
    return h;
  };

  const topZ = (s: number) => {
    if (s < sF + Rv) return g.zBonnetFront - curl(Rv, sF + Rv - s);
    const b0 = sF + Rv;
    const b1 = g.sWindscreen - 60;
    if (s < b1) return lerp(g.zBonnetFront, g.zBonnet, 1 - (1 - (s - b0) / (b1 - b0)) ** 2);
    if (s < g.sWindscreen) return lerp(g.zBonnet, g.zCowl, smooth((s - b1) / 60));
    // The cowl rises to the beltline exactly where the windscreen line reaches it.
    if (s < g.sWindscreen + rise) return lerp(g.zCowl, g.zBelt, smooth((s - g.sWindscreen) / rise));
    if (s < g.tubFront - 80) return g.zBelt;
    if (s < sR - RvR) return lerp(g.zBelt, g.tubRail, smooth((s - (g.tubFront - 80)) / 80));
    return g.tubRail - curl(RvR, s - (sR - RvR));
  };

  const bottomZ = (s: number) => {
    let z = zb;
    if (s < sF + Rch) z = zb + curl(Rch, sF + Rch - s);
    if (s > sR - RchR) z = zb + curl(RchR, s - (sR - RchR)) * 0.6;
    for (const cx of arches) {
      const d = s - cx;
      if (Math.abs(d) < archR) z = Math.max(z, g.wheelR + Math.sqrt(archR * archR - d * d));
    }
    return z;
  };

  const section = (s: number): Section => {
    const z0 = bottomZ(s);
    const z1 = topZ(s);
    const h = z1 - z0;
    // Large shoulder radius on the bonnet and cab, tighter on the tub rails, blended before the tub.
    const shoulder = lerp(125, 60, smooth((s - (g.tubFront - 80)) / 80));
    return {
      z0,
      z1,
      half: planHalf(s),
      lean: Math.min(32, h * 0.05),
      rt: Math.max(4, Math.min(shoulder, h * 0.42)),
      rb: Math.max(4, Math.min(60, h * 0.3)),
      crown: s < g.sWindscreen ? 18 * (1 - smooth((s - (g.sWindscreen - 160)) / 100)) : 0,
    };
  };

  const sideY = (s: number, z: number) => widthAt(section(s), z);

  // Where the nose surface is: the first station whose outline reaches (y, z).
  // Uses the same sections as the loft, so parts sit on the surface that is drawn.
  const frontX = (y: number, z: number) => {
    for (let s = sF; s < sF + 800; s += 2) {
      if (widthAt(section(s), z) >= Math.abs(y)) return s;
    }
    return sF + 800;
  };

  // Lower body: front and cab, tub, tailgate. The cab's rear cap is the tub's headboard.
  const fine: [number, number, number][] = [
    [sF, sF + 260, 10],
    ...arches.map((cx): [number, number, number] => [cx - archR - 20, cx + archR + 20, 12]),
    [g.sWindscreen - 100, g.sWindscreen + 200, 15],
    [g.tubFront - 100, g.tubFront, 15],
    [sR - 140, sR, 10],
  ];
  const closed = (xs: number[]): Station[] => xs.map((x) => ({ x, zones: [closedRing(section(x))] }));
  const front = loft(closed(stationsBetween(sF, g.tubFront, 45, fine)), { capStart: true, capEnd: true });
  const tub = loft(
    stationsBetween(g.tubFront, g.tubRear, 45, fine).map((x) => ({ x, zones: tubZones(section(x), g.tubInnerW / 2, g.tubFloor - 40) })),
  );
  const tail = loft(closed(stationsBetween(g.tubRear, sR, 20, fine)), { capStart: true, capEnd: true });

  return { section, topZ, sideY, frontX, body: [front, tub, tail], greenhouse: greenhouse(g), archR };
}

/** Cab glasshouse: one rounded surface split into roof (paint), pillars and frames (trim) and glass. */
function greenhouse(g: UteGeometry): THREE.BufferGeometry {
  const rake = 1.15;
  const sStart = g.sWindscreen + (g.zBelt - g.zCowl) * rake;
  const sEnd = g.sCabBack - 10;
  const windscreen = (s: number) => g.zCowl + (s - g.sWindscreen) / rake;
  const rear = (s: number) => g.zBelt + ((g.zRoof - g.zBelt) * (sEnd - s)) / (sEnd - g.sRoofBack);
  const topAt = (s: number) => Math.max(g.zBelt + 2, softMin(softMin(windscreen(s), g.zRoof, 45), rear(s), 35));
  const halfAt = (z: number) => lerp(g.beltHalf, g.roofHalf, (z - g.zBelt) / (g.zRoof - g.zBelt));

  type Tag = 'side' | 'corner' | 'top';
  const tags: Tag[] = [];
  const ringAt = (s: number) => {
    const zt = topAt(s);
    const h = zt - g.zBelt;
    const rt = Math.max(2, Math.min(110, h * 0.45));
    const sideTop = zt - rt;
    const right: Pt[] = [[halfAt(g.zBelt), g.zBelt], ...line([halfAt(g.zBelt), g.zBelt], [halfAt(sideTop), sideTop], 5)];
    right.push(...arc(halfAt(sideTop) - rt, sideTop, rt, 0, Math.PI / 2, 6));
    const topHalf = halfAt(sideTop) - rt;
    const crown = (22 * h) / (g.zRoof - g.zBelt);
    for (let i = 1; i <= 4; i++) {
      const y = topHalf * (1 - i / 4);
      right.push([y, zt + crown * (1 - (y / Math.max(topHalf, 1)) ** 2)]);
    }
    return { ring: [...right, ...mirror(right).slice(1)], sideTop };
  };
  // Tags follow the point layout of ringAt: 6 side, 6 corner, 4 top per half.
  const half: Tag[] = [...Array(6).fill('side'), ...Array(6).fill('corner'), ...Array(4).fill('top')];
  tags.push(...half, ...half.slice(0, -1).reverse());

  const xs = stationsBetween(sStart, sEnd, 30, [
    [sStart, g.sWindscreenTop + 80, 12],
    [g.bPillar - 60, g.bPillar + 60, 10],
    [g.sRoofBack - 160, sEnd, 12],
  ]);
  const rings = xs.map(ringAt);
  const frontWindow = (s: number) => s > sStart + 60 && s < g.bPillar - 45;
  const rearWindow = (s: number) => s > g.bPillar + 45 && s < g.sRoofBack - 110;

  return loft(
    rings.map((r, j) => ({ x: xs[j], zones: [r.ring] })),
    {
      group: (j, _k, i) => {
        const s = (xs[j] + xs[j + 1]) / 2;
        const ta = tags[i];
        const tb = tags[i + 1];
        const tag: Tag = ta === 'corner' || tb === 'corner' ? 'corner' : ta === 'top' || tb === 'top' ? 'top' : 'side';
        const z = (rings[j].ring[i][1] + rings[j].ring[i + 1][1]) / 2;
        const sideGlass = () =>
          (frontWindow(s) || rearWindow(s)) && z > g.zBelt + 28 && z < rings[j].sideTop - 25 ? GLASS : TRIM;
        if (tag === 'side') return sideGlass();
        if (s < g.sWindscreenTop - 50) return tag === 'top' && z > g.zBelt + 30 ? GLASS : TRIM;
        if (s < g.sWindscreenTop + 10) return TRIM;
        if (s <= g.sRoofBack + 30) return PAINT;
        return tag === 'top' && z > g.zBelt + 60 ? GLASS : TRIM;
      },
    },
  );
}
