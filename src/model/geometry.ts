// Derived body geometry for the generic ute, SUV and caravan, shared by the 3D view
// and the default item placements. Proportions are generic dual-cab and five-seat
// SUV ones, scaled to the entered dimensions.

import type { CaravanSpec, HitchSpec, Host, ItemSize, Placement, Setup, UteSpec, Vec3 } from './types';
import { rimDiameter, tyreDiameter, tyreWidth } from './tyres';

export interface UteGeometry {
  /** A five-seat SUV: the cabin runs to the tailgate and the "tub" is the cargo floor inside. */
  suv: boolean;
  L: number;
  sFront: number;
  sRear: number;
  wheelR: number;
  tyreW: number;
  bodyW: number;
  bumperBottom: number;
  bodyBottom: number;
  /** Rim radius (mm). */
  rimR: number;
  zBonnet: number;
  zBonnetFront: number;
  zCowl: number;
  zBelt: number;
  zRoof: number;
  zRails: number;
  sWindscreen: number;
  sWindscreenTop: number;
  sRoofBack: number;
  /** Back of the cab (ute) or of the glasshouse at the tailgate (SUV). */
  sCabBack: number;
  bPillar: number;
  /** SUV only: the back of the rear doors. */
  cPillar: number | null;
  /** Half-width of the greenhouse at the beltline and at the roof (tumblehome). */
  beltHalf: number;
  roofHalf: number;
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
  const suv = ute.bodyStyle === 'suv';
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
  const zBonnetFront = zBonnet - 60;
  const zCowl = zBonnet + 40;
  const tubRail = ute.tub.floorHeight + ute.tub.depth;
  // Modern utes carry the beltline through to the tub rails.
  const zBelt = suv ? zBonnet + 150 : Math.max(zBonnet + 90, Math.min(tubRail - 30, zBonnet + 200));
  const bumperBottom = Math.max(300, wheelR * 1.08);
  const bodyBottom = wheelR + 80;

  const tubRear = sRear - (suv ? 110 : 140);
  const tubFront = tubRear - ute.tub.length;
  const sCabBack = suv ? sRear - 50 : tubFront - 90;
  const sWindscreen = sFront + (suv ? 0.32 : 0.3) * ute.overallLength;
  const sWindscreenTop = sWindscreen + (zRoof - zCowl) * 1.15;
  // An SUV's tailgate glass leans forward from the bumper to the roof.
  const sRoofBack = suv ? sRear - 330 : sCabBack - 90;
  // The seats fill the cab, or the SUV's cabin up to the cargo floor.
  const cabEnd = suv ? tubFront - 90 : sCabBack;
  const cabLen = cabEnd - sWindscreen;

  const seatZ = Math.round(bumperBottom + 0.4 * (zRoof - bumperBottom));
  const frontRow = Math.round(sWindscreen + 0.36 * cabLen);
  const rearRow = Math.round(sWindscreen + 0.76 * cabLen);
  const front = Math.round(0.24 * bodyW);
  const rear = Math.round(0.26 * bodyW);
  const seats: Vec3[] = [
    { x: frontRow, y: front, z: seatZ },
    { x: frontRow, y: -front, z: seatZ },
    { x: rearRow, y: rear, z: seatZ },
    { x: rearRow, y: -rear, z: seatZ },
    { x: rearRow, y: 0, z: seatZ },
  ];

  return {
    suv,
    L,
    sFront,
    sRear,
    wheelR,
    tyreW,
    bodyW,
    bumperBottom,
    bodyBottom,
    rimR: ((rimDiameter(ute.tyre.size) ?? 18) * 25.4) / 2,
    zBonnet,
    zBonnetFront,
    zCowl,
    zBelt,
    zRoof,
    zRails,
    sWindscreen,
    sWindscreenTop,
    sRoofBack,
    sCabBack,
    bPillar: sWindscreen + (suv ? 0.55 : 0.52) * cabLen,
    cPillar: suv ? Math.min(cabEnd + 60, L - 150) : null,
    beltHalf: bodyW / 2 - 70,
    roofHalf: bodyW / 2 - 175,
    tubFront,
    tubRear,
    tubFloor: ute.tub.floorHeight,
    tubRail,
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
  /** Centre of the axle group. */
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

/**
 * Tow ball centre to the centre of the axle group. Tandem axles are taken to
 * share the load equally, so the group acts as one axle at their average position.
 */
export function axleCentre(cv: Pick<CaravanSpec, 'axles'>): number {
  return cv.axles.reduce((sum, x) => sum + x, 0) / cv.axles.length;
}

export function caravanGeometry(cv: CaravanSpec, hitch: HitchSpec): CaravanGeometry {
  return {
    a: axleCentre(cv),
    bodyStart: cv.bodyStart,
    bodyEnd: cv.bodyStart + cv.bodyLength,
    floorZ: cv.floorHeight,
    roofZ: cv.floorHeight + cv.bodyHeight,
    couplingZ: hitch.ballHeight,
    drawbarStart: Math.max(350, cv.bodyStart - 1100),
    drawbarZ: hitch.ballHeight + 40,
    wheelR: (tyreDiameter(cv.tyre.size) ?? 760) / 2,
    tyreW: tyreWidth(cv.tyre.size) ?? 235,
    axles: [...cv.axles],
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
  | 'cvRoof'
  | 'cvBoat'
  | 'cvTransom'
  | 'cvBoatInside';

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
  cvBoat: 'caravan',
  cvTransom: 'caravan',
  cvBoatInside: 'caravan',
};

/** Share of a boat hull's height that is solid below the cockpit floor (also used by the 3D hull). */
export const BOAT_FLOOR = 0.35;

function boatHull(setup: Setup) {
  return setup.items.find((i) => i.host === 'caravan' && i.shape === 'boat' && i.enabled);
}

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
      // Caravans: over the axles, as packing guides advise. Cargo trailers: the middle of the tray, ahead of the axle.
      return van({ x: setup.caravan.kind === 'caravan' ? c.a : (c.bodyStart + c.bodyEnd) / 2, y: 0, z: c.floorZ + size.h / 2 });
    case 'cvFloorRear':
      return van({ x: c.bodyEnd - size.l / 2 - 100, y: 0, z: c.floorZ + size.h / 2 });
    case 'cvUnderFloor':
      return van({ x: Math.min(...c.axles) - c.wheelR - size.l / 2 - 250, y: 0, z: c.floorZ - 120 - size.h / 2 });
    case 'cvRearBumper':
      return van({ x: c.bodyEnd + size.l / 2 + 80, y: 0, z: c.floorZ + size.h / 2 - 150 });
    case 'cvRoof':
      return van({ x: (c.bodyStart + c.bodyEnd) / 2, y: 0, z: c.roofZ + size.h / 2 });
    case 'cvBoat':
      // Bow just behind the winch post, sitting on the bunks.
      return van({ x: c.bodyStart + 200 + size.l / 2, y: 0, z: c.floorZ + size.h / 2 });
    case 'cvTransom': {
      const hull = boatHull(setup);
      if (!hull) return van({ x: c.bodyEnd - size.l / 2, y: 0, z: c.floorZ + size.h / 2 });
      return van({ x: hull.pos.x + hull.size.l / 2 + size.l / 2 - 120, y: 0, z: hull.pos.z + hull.size.h / 2 });
    }
    case 'cvBoatInside': {
      const hull = boatHull(setup);
      if (!hull) return van({ x: c.a, y: 0, z: c.floorZ + size.h / 2 });
      const floor = hull.pos.z - hull.size.h / 2 + hull.size.h * BOAT_FLOOR;
      return van({ x: hull.pos.x + hull.size.l * 0.22, y: 0, z: floor + size.h / 2 });
    }
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
