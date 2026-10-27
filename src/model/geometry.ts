// Derived body geometry for the generic ute and caravan, shared by the 3D view
// and the default item placements. Proportions are generic dual-cab ones,
// scaled to the entered dimensions.

import type { CaravanSpec, HitchSpec, Host, ItemSize, Placement, Setup, UteSpec, Vec3 } from './types';
import { tyreDiameter, tyreWidth } from './tyres';

export interface UteGeometry {
  L: number;
  sFront: number;
  sRear: number;
  wheelR: number;
  tyreW: number;
  bodyW: number;
  bumperBottom: number;
  bodyBottom: number;
  zBonnet: number;
  zBelt: number;
  zRoof: number;
  zRails: number;
  sWindscreen: number;
  sWindscreenTop: number;
  sRoofBack: number;
  sCabBack: number;
  tubFront: number;
  tubRear: number;
  tubFloor: number;
  tubRail: number;
  tubInnerW: number;
  wheels: { id: 'fl' | 'fr' | 'rl' | 'rr'; x: number; y: number }[];
  seats: Vec3[];
  ball: Vec3;
}

export function uteGeometry(ute: UteSpec, hitch: HitchSpec): UteGeometry {
  const L = ute.wheelbase;
  const sFront = -ute.frontOverhang;
  const rearOverhang = Math.max(400, ute.overallLength - L - ute.frontOverhang);
  const sRear = L + rearOverhang;
  const wheelR = (tyreDiameter(ute.tyre.size) ?? 780) / 2;
  const tyreW = tyreWidth(ute.tyre.size) ?? 265;
  const bodyW = ute.overallWidth - 20;
  const H = ute.overallHeight;
  const zRails = H;
  const zRoof = H - 55;
  const zBonnet = Math.round(H * 0.64);
  const zBelt = zBonnet + 70;
  const bumperBottom = Math.max(300, wheelR * 1.08);
  const bodyBottom = wheelR + 80;

  const tubRear = sRear - 140;
  const tubFront = tubRear - ute.tub.length;
  const sCabBack = tubFront - 90;
  const sWindscreen = sFront + 0.29 * ute.overallLength;
  const sWindscreenTop = sWindscreen + (zRoof - zBelt) * 1.25;
  const sRoofBack = sCabBack - 60;
  const cabLen = sCabBack - sWindscreen;

  const seatZ = zBelt - 300;
  const frontRow = sWindscreen + 0.36 * cabLen;
  const rearRow = sWindscreen + 0.76 * cabLen;
  const seats: Vec3[] = [
    { x: frontRow, y: 0.24 * bodyW, z: seatZ },
    { x: frontRow, y: -0.24 * bodyW, z: seatZ },
    { x: rearRow, y: 0.26 * bodyW, z: seatZ },
    { x: rearRow, y: -0.26 * bodyW, z: seatZ },
    { x: rearRow, y: 0, z: seatZ },
  ];

  return {
    L,
    sFront,
    sRear,
    wheelR,
    tyreW,
    bodyW,
    bumperBottom,
    bodyBottom,
    zBonnet,
    zBelt,
    zRoof,
    zRails,
    sWindscreen,
    sWindscreenTop,
    sRoofBack,
    sCabBack,
    tubFront,
    tubRear,
    tubFloor: ute.tub.floorHeight,
    tubRail: ute.tub.floorHeight + ute.tub.depth,
    tubInnerW: Math.min(ute.tub.width, bodyW - 120),
    wheels: [
      { id: 'fl', x: 0, y: -ute.trackFront / 2 },
      { id: 'fr', x: 0, y: ute.trackFront / 2 },
      { id: 'rl', x: L, y: -ute.trackRear / 2 },
      { id: 'rr', x: L, y: ute.trackRear / 2 },
    ],
    seats,
    ball: { x: L + hitch.ballOffset, y: 0, z: hitch.ballHeight },
  };
}

export interface CaravanGeometry {
  a: number;
  bodyStart: number;
  bodyEnd: number;
  floorZ: number;
  roofZ: number;
  couplingZ: number;
  drawbarStart: number;
  drawbarZ: number;
  wheelR: number;
  tyreW: number;
  axles: number[];
}

export function caravanGeometry(cv: CaravanSpec, hitch: HitchSpec): CaravanGeometry {
  const a = cv.couplingToAxle;
  const axles = cv.axleCount === 2 ? [a - cv.axleSpacing / 2, a + cv.axleSpacing / 2] : [a];
  return {
    a,
    bodyStart: cv.bodyStart,
    bodyEnd: cv.bodyStart + cv.bodyLength,
    floorZ: cv.floorHeight,
    roofZ: cv.floorHeight + cv.bodyHeight,
    couplingZ: hitch.ballHeight,
    drawbarStart: Math.max(350, cv.bodyStart - 1100),
    drawbarZ: hitch.ballHeight + 40,
    wheelR: (tyreDiameter(cv.tyre.size) ?? 760) / 2,
    tyreW: tyreWidth(cv.tyre.size) ?? 235,
    axles,
  };
}

/** Distance from the front axle to the coupling, which is where the caravan frame starts. */
export function caravanOffset(setup: Pick<Setup, 'ute' | 'hitch'>): number {
  return setup.ute.wheelbase + setup.hitch.ballOffset;
}

// World space (three.js, metres): +X forward, +Y up, +Z right.

export function toWorld(host: Host, p: Vec3, offset: number): [number, number, number] {
  const s = host === 'ute' ? p.x : offset + p.x;
  return [-s / 1000, p.z / 1000, p.y / 1000];
}

export function fromWorld(host: Host, w: { x: number; y: number; z: number }, offset: number): Vec3 {
  const s = -w.x * 1000;
  return { x: host === 'ute' ? s : s - offset, y: w.z * 1000, z: w.y * 1000 };
}

export function dirFromWorld(n: { x: number; y: number; z: number }): Vec3 {
  return { x: -n.x, y: n.z, z: n.y };
}

/** Item centre when its box rests against a surface at `point` facing `normal` (both in the host frame). */
export function restOnSurface(point: Vec3, normal: Vec3, size: ItemSize): Vec3 {
  return {
    x: point.x + (normal.x * size.l) / 2,
    y: point.y + (normal.y * size.w) / 2,
    z: point.z + (normal.z * size.h) / 2,
  };
}

export function nearestSeat(seats: Vec3[], p: Vec3): Vec3 {
  let best = seats[0];
  let bestD = Infinity;
  for (const s of seats) {
    const d = (s.x - p.x) ** 2 + (s.y - p.y) ** 2;
    if (d < bestD) {
      bestD = d;
      best = s;
    }
  }
  return best;
}

export type Anchor =
  | 'bullbar'
  | 'frontBumper'
  | 'roof'
  | 'tub'
  | 'tubFront'
  | 'tubRear'
  | 'underTub'
  | 'seat'
  | 'towbar'
  | 'hitch'
  | 'cvDrawbar'
  | 'cvFloorFront'
  | 'cvFloorCentre'
  | 'cvFloorRear'
  | 'cvUnderFloor'
  | 'cvRearBumper'
  | 'cvRoof';

export const ANCHOR_HOST: Record<Anchor, Host> = {
  bullbar: 'ute',
  frontBumper: 'ute',
  roof: 'ute',
  tub: 'ute',
  tubFront: 'ute',
  tubRear: 'ute',
  underTub: 'ute',
  seat: 'ute',
  towbar: 'ute',
  hitch: 'ute',
  cvDrawbar: 'caravan',
  cvFloorFront: 'caravan',
  cvFloorCentre: 'caravan',
  cvFloorRear: 'caravan',
  cvUnderFloor: 'caravan',
  cvRearBumper: 'caravan',
  cvRoof: 'caravan',
};

/** Default placement for a new item, used when it is added by click instead of drag. */
export function anchorPlacement(anchor: Anchor, size: ItemSize, setup: Setup, occupied: Vec3[] = []): Placement {
  const g = uteGeometry(setup.ute, setup.hitch);
  const c = caravanGeometry(setup.caravan, setup.hitch);
  const tubMid = (g.tubFront + g.tubRear) / 2;
  const ute = (pos: Vec3): Placement => ({ host: 'ute', pos });
  const van = (pos: Vec3): Placement => ({ host: 'caravan', pos });
  switch (anchor) {
    case 'bullbar':
      return ute({ x: g.sFront - size.l / 2 + 40, y: 0, z: g.bumperBottom + size.h / 2 - 40 });
    case 'frontBumper':
      return ute({ x: g.sFront - size.l / 2 - 60, y: 0, z: g.bumperBottom + 160 });
    case 'roof':
      return ute({ x: (g.sWindscreenTop + g.sRoofBack) / 2, y: 0, z: g.zRails + size.h / 2 });
    case 'tub':
      return ute({ x: tubMid, y: 0, z: g.tubFloor + size.h / 2 });
    case 'tubFront':
      return ute({ x: g.tubFront + size.l / 2 + 20, y: 0, z: g.tubFloor + size.h / 2 });
    case 'tubRear':
      return ute({ x: g.tubRear - size.l / 2 - 20, y: 0, z: g.tubFloor + size.h / 2 });
    case 'underTub':
      return ute({ x: tubMid, y: 0, z: Math.max(size.h / 2 + 200, g.tubFloor - 300 - size.h / 2) });
    case 'seat': {
      const free = g.seats.find((s) => !occupied.some((o) => Math.abs(o.x - s.x) < 50 && Math.abs(o.y - s.y) < 50));
      return ute(free ?? g.seats[0]);
    }
    case 'towbar':
      return ute({ x: g.ball.x + size.l / 2 + 80, y: 0, z: g.ball.z + size.h / 2 + 40 });
    case 'hitch':
      return ute({ x: g.ball.x - size.l / 2, y: 0, z: g.ball.z - 60 });
    case 'cvDrawbar':
      return van({ x: c.bodyStart - size.l / 2 - 120, y: 0, z: c.drawbarZ + size.h / 2 });
    case 'cvFloorFront':
      return van({ x: c.bodyStart + size.l / 2 + 100, y: 0, z: c.floorZ + size.h / 2 });
    case 'cvFloorCentre':
      return van({ x: c.a, y: 0, z: c.floorZ + size.h / 2 });
    case 'cvFloorRear':
      return van({ x: c.bodyEnd - size.l / 2 - 100, y: 0, z: c.floorZ + size.h / 2 });
    case 'cvUnderFloor':
      return van({ x: c.a - c.wheelR - size.l / 2 - 250, y: 0, z: c.floorZ - 120 - size.h / 2 });
    case 'cvRearBumper':
      return van({ x: c.bodyEnd + size.l / 2 + 80, y: 0, z: c.floorZ + size.h / 2 - 150 });
    case 'cvRoof':
      return van({ x: (c.bodyStart + c.bodyEnd) / 2, y: 0, z: c.roofZ + size.h / 2 });
  }
}

const round10 = (v: number) => Math.round(v / 10) * 10;

/** Placement of an item dropped or dragged onto a surface hit (host frame). */
export function placeFromHit(
  item: { size: ItemSize; snap?: 'seat' },
  hit: { host: Host; point: Vec3; normal: Vec3 },
  setup: Setup,
): Placement {
  if (item.snap === 'seat' && hit.host === 'ute') {
    const g = uteGeometry(setup.ute, setup.hitch);
    return { host: 'ute', pos: { ...nearestSeat(g.seats, hit.point) } };
  }
  const p = restOnSurface(hit.point, hit.normal, item.size);
  return { host: hit.host, pos: { x: round10(p.x), y: round10(p.y), z: round10(p.z) } };
}
