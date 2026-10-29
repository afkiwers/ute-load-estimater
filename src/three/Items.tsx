import { useEffect, useMemo, type RefObject } from 'react';
import * as THREE from 'three';
import { Edges, Html, RoundedBox } from '@react-three/drei';
import { useThree, type ThreeEvent } from '@react-three/fiber';
import type { ItemShape, ItemSize, LoadItem } from '../model/types';
import { BOAT_FLOOR, toWorld } from '../model/geometry';
import { labelLayer, useUi } from '../state/ui';
import { Mat } from './parts';

type Axis = 'x' | 'y' | 'z';

/** A cylinder's axis is the dimension that differs from the other two (a gas bottle stands up, a spare wheel on a bumper faces back). */
function cylinderAxis({ l, w, h }: ItemSize): Axis {
  const close = (a: number, b: number) => Math.abs(a - b) <= 0.1 * Math.max(a, b);
  if (close(l, w)) return 'z';
  if (close(w, h)) return 'x';
  if (close(l, h)) return 'y';
  return 'z';
}

interface ShapeProps {
  shape: ItemShape;
  size: ItemSize;
  color: string;
  opacity: number;
  outline?: string | null;
  userData?: Record<string, unknown>;
  onPointerDown?: (e: ThreeEvent<PointerEvent>) => void;
  onPointerOver?: (e: ThreeEvent<PointerEvent>) => void;
  onPointerOut?: (e: ThreeEvent<PointerEvent>) => void;
}

type V3 = [number, number, number];

const smooth = (t: number) => t * t * (3 - 2 * t);

/** Cross-section of the hull at a share s of its length from the transom (0) to the bow (1), in metres around the box centre. */
interface Section {
  x: number;
  /** Right side from the keel up over the rub rail, as [height, half-width]; the left side mirrors it. */
  side: [number, number][];
  sheerY: number;
  /** Half-width of the deck edge, at the top of the rub rail. */
  edge: number;
}

/** Strips of the hull side, between consecutive section points: what each one is painted. */
const HULL_STRIPS = ['hull', 'hull', 'hull', 'accent', 'hull', 'trim'] as const;

/** Share of the length behind the transom taken by the swim platform. */
const PLATFORM = 0.08;

/** Fore-and-aft position of a share s of the hull from the transom (0) to the bow (1); the swim platform is aft of 0. */
const hullX = (s: number, l: number) => -l / 2 + l * (PLATFORM + s * (1 - PLATFORM));

function hullSection(s: number, l: number, w: number, h: number): Section {
  const x = hullX(s, l);
  // Full beam aft, a full bow drawn to a point.
  const halfBeam = s <= 0.45 ? (w / 2) * (0.94 + 0.06 * (s / 0.45)) : (w / 2) * Math.max(0, 1 - Math.pow((s - 0.45) / 0.55, 1.8));
  // The sheer sweeps up to a high bow; the forefoot rises in a long curve, so the stem rakes forward.
  const sheerY = h / 2 - 0.2 * h * Math.pow(1 - s, 1.4);
  const bow = Math.max(0, (s - 0.4) / 0.6);
  const keelY = -h / 2 + 0.68 * h * Math.pow(bow, 1.7);
  // Deep V to a spray rail, a flared lower side up to the knuckle (the widest line), an accent line under it, the
  // upper side leaning in, and a rub rail.
  const chineY = keelY + 0.2 * h * (1 - 0.5 * smooth(bow));
  const knuckleY = chineY + (sheerY - chineY) * 0.42;
  const rail = Math.min(0.04, 0.08 * (sheerY - chineY));
  return {
    x,
    side: [
      [keelY, 0],
      [chineY, 0.7 * halfBeam],
      [chineY + rail * 0.3, 0.78 * halfBeam],
      [knuckleY - rail, 0.985 * halfBeam],
      [knuckleY, halfBeam],
      [sheerY - rail, 0.93 * halfBeam],
      [sheerY, 0.91 * halfBeam],
    ],
    sheerY,
    edge: 0.91 * halfBeam,
  };
}

/**
 * Joins the same strip of successive sections into one smooth surface: shaded smoothly along the hull, with a crease
 * between strips. Each row runs so the faces' fronts point outwards.
 */
class Skin {
  pos: number[] = [];
  index: number[] = [];
  strip(rows: V3[][], i: number) {
    const base = this.pos.length / 3;
    for (const row of rows) this.pos.push(...row[i], ...row[i + 1]);
    for (let j = 0; j + 1 < rows.length; j++) {
      const a = base + 2 * j;
      this.index.push(a, a + 2, a + 3, a, a + 3, a + 1);
    }
  }
  geometry() {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.pos, 3));
    g.setIndex(this.index);
    g.computeVertexNormals();
    return g;
  }
}

/** Open cockpit, as shares of the length from the transom. */
const COCKPIT: [number, number] = [0.07, 0.86];
const STATIONS = (() => {
  const xs = new Set<number>();
  for (let i = 0; i <= 48; i++) xs.add(Math.round((1 - Math.pow(1 - i / 48, 1.3)) * 1e4) / 1e4);
  // Close pairs where the cockpit starts and ends keep its walls upright.
  for (const c of COCKPIT) [c, c + 0.003].forEach((v) => xs.add(v));
  return [...xs].sort((a, b) => a - b);
})();

/** Hull skin, deck, cockpit and transom (metres, bow at +x, centred on the item box). */
function hullGeometry(l: number, w: number, h: number) {
  const floorY = -h / 2 + h * BOAT_FLOOR;
  const sections = STATIONS.map((s) => ({ s, ...hullSection(s, l, w, h) }));
  const right = sections.map((c) => c.side.map(([y, z]) => [c.x, y, z] as V3));
  // The left side runs the other way round so its faces point out too.
  const left = sections.map((c) => c.side.map(([y, z]) => [c.x, y, -z] as V3).reverse());
  const skins = { hull: new Skin(), accent: new Skin(), trim: new Skin(), gunwale: new Skin(), cockpit: new Skin(), transom: new Skin() };
  const n = HULL_STRIPS.length;
  HULL_STRIPS.forEach((paint, i) => {
    skins[paint].strip(right, i);
    skins[paint].strip(left, n - 1 - i);
  });

  // Deck from the right rub rail to the left: gunwale, down into the cockpit where there is one, across, and up again.
  const deck = sections.map((c) => {
    const inner = Math.max(0, c.edge - Math.min(0.2, 0.32 * c.edge));
    const fy = c.s > COCKPIT[0] && c.s <= COCKPIT[1] ? floorY : c.sheerY;
    return [
      [c.x, c.sheerY, c.edge],
      [c.x, c.sheerY + 0.01, inner],
      [c.x, fy, inner],
      [c.x, fy, -inner],
      [c.x, c.sheerY + 0.01, -inner],
      [c.x, c.sheerY, -c.edge],
    ] as V3[];
  });
  [0, 4].forEach((i) => skins.gunwale.strip(deck, i));
  [1, 2, 3].forEach((i) => skins.cockpit.strip(deck, i));

  // Transom: the stern outline closed across the deck, as a fan facing aft.
  const ring = [...right[0], ...left[0]];
  const c: V3 = [sections[0].x, (ring[0][1] + sections[0].sheerY) / 2, 0];
  const t = skins.transom;
  t.pos.push(...c, ...ring.flat());
  for (let i = 0; i < ring.length; i++) t.index.push(0, 1 + i, 1 + ((i + 1) % ring.length));
  return { ...Object.fromEntries(Object.entries(skins).map(([k, v]) => [k, v.geometry()])), floorY } as Record<keyof typeof skins, THREE.BufferGeometry> & {
    floorY: number;
  };
}

/** A round bar between two points (metres). */
function Bar({ a, b, r, color, opacity }: { a: V3; b: V3; r: number; color: string; opacity: number }) {
  const va = new THREE.Vector3(...a);
  const vb = new THREE.Vector3(...b);
  const dir = vb.clone().sub(va);
  const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.clone().normalize());
  return (
    <mesh position={va.add(vb).multiplyScalar(0.5)} quaternion={q} castShadow>
      <cylinderGeometry args={[r, r, dir.length(), 12]} />
      <Mat color={color} opacity={opacity} roughness={0.3} metalness={0.6} />
    </mesh>
  );
}

/** A tube along a smooth curve through the points (metres). */
function useTube(points: V3[], r: number) {
  const key = JSON.stringify(points);
  const geo = useMemo(() => {
    const curve = new THREE.CatmullRomCurve3(points.map((p) => new THREE.Vector3(...p)), false, 'centripetal');
    return new THREE.TubeGeometry(curve, 64, r, 12, false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, r]);
  useEffect(() => () => geo.dispose(), [geo]);
  return geo;
}

const ACCENT = '#c41e2c';
const UPHOLSTERY = '#d3d6da';
const TRIM = '#16181b';
const FLOOR = '#4b5057';
const BRONZE = '#c9a23a';

/** A padded cushion: a rounded block (metres, centre and size). */
function Cushion({ p, s, color, opacity }: { p: V3; s: V3; color: string; opacity: number }) {
  return (
    <RoundedBox position={p} args={s} radius={Math.min(0.05, ...s.map((v) => v * 0.3))} smoothness={3} castShadow>
      <Mat color={color} opacity={opacity} roughness={0.75} />
    </RoundedBox>
  );
}

/** Wrap-around windscreen: raked glass panels from each gunwale angling in to a walk-through in the middle. */
function useWindscreen(l: number, w: number, h: number) {
  return useMemo(() => {
    const height = Math.min(0.4, 0.48 * h);
    const pos: number[] = [];
    const frames: V3[][] = [];
    for (const sgn of [-1, 1]) {
      // Plan corners: at the gunwale, the turn, and the walk-through.
      const plan: [number, number][] = [
        [0.55, 0.93],
        [0.63, 0.62],
        [0.67, 0.26],
      ].map(([s, share]) => [s, share]);
      const bottom = plan.map(([s, share]) => {
        const sec = hullSection(s, l, w, h);
        return [sec.x, sec.sheerY + 0.01, sgn * share * sec.edge] as V3;
      });
      // The top leans aft and slightly in.
      const top = bottom.map(([x, y, z]) => [x - 0.45 * height, y + height, z * 0.96] as V3);
      for (let i = 0; i + 1 < bottom.length; i++) pos.push(...bottom[i], ...bottom[i + 1], ...top[i + 1], ...bottom[i], ...top[i + 1], ...top[i]);
      frames.push([top[0], top[1], top[2]]);
    }
    const glass = new THREE.BufferGeometry();
    glass.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    glass.computeVertexNormals();
    return { glass, frames };
  }, [l, w, h]);
}

/**
 * Wake boat with an inboard engine: a deep V hull with a raked bow, spray rails, a flared knuckle with an accent line and a rub rail; a
 * cockpit recessed to the floor height the palette places gear on, with wrap-around seating, helm and passenger
 * consoles, a curved windscreen and a swept wakeboard tower with speakers; the engine hatch aft, the shaft, propeller and
 * rudder under the hull, and a swim platform across the stern. The hull colour is the item's.
 */
function BoatHull({ size, color, opacity, outline, userData, events }: Omit<ShapeProps, 'shape'> & { events: Record<string, unknown> }) {
  const l = size.l / 1000;
  const w = size.w / 1000;
  const h = size.h / 1000;
  const geo = useMemo(() => hullGeometry(l, w, h), [l, w, h]);
  useEffect(() => () => Object.values(geo).forEach((g) => typeof g === 'object' && g.dispose()), [geo]);
  const screen = useWindscreen(l, w, h);
  useEffect(() => () => screen.glass.dispose(), [screen]);

  const at = (s: number) => hullSection(s, l, w, h);
  const x = (s: number) => hullX(s, l);
  const inner = (s: number) => at(s).edge - Math.min(0.2, 0.32 * at(s).edge);
  const f = geo.floorY;
  const seatH = Math.min(0.4, (at(0.3).sheerY - f) * 0.75);
  const seatW = Math.min(0.45, inner(0.3) * 0.45);
  const hatchW = Math.min(0.9, inner(0.17) * 0.9);
  const platformY = -h / 2 + 0.3 * h;
  const platformW = 2 * at(0).edge;
  const seat = (s0: number, s1: number, z0: number, z1: number, back: 'out' | 'aft' | 'none') => {
    const cx = (x(s0) + x(s1)) / 2;
    const cz = (z0 + z1) / 2;
    const len = x(s1) - x(s0);
    const wid = Math.abs(z1 - z0);
    return (
      <group key={`${s0}${z0}`}>
        <Cushion p={[cx, f + seatH * 0.4, cz]} s={[len, seatH * 0.8, wid]} color="#2a2e33" opacity={opacity} />
        <Cushion p={[cx, f + seatH * 0.92, cz]} s={[len - 0.02, seatH * 0.24, wid - 0.02]} color={UPHOLSTERY} opacity={opacity} />
        <Cushion p={[cx, f + seatH * 0.93, cz]} s={[len * 0.7, seatH * 0.25, wid * 0.35]} color={ACCENT} opacity={opacity} />
        {back === 'out' && (
          <Cushion p={[cx, f + seatH * 1.35, cz + Math.sign(cz) * (wid / 2 - 0.05)]} s={[len - 0.04, seatH * 0.7, 0.09]} color={UPHOLSTERY} opacity={opacity} />
        )}
        {back === 'aft' && <Cushion p={[x(s0) + 0.05, f + seatH * 1.35, cz]} s={[0.09, seatH * 0.7, wid - 0.04]} color={UPHOLSTERY} opacity={opacity} />}
      </group>
    );
  };

  // Tower: an arch from the gunwales amidships, swept forward over the cockpit, with braces aft.
  const tS = 0.42;
  const tx = x(tS);
  const ty = at(tS).sheerY;
  const tz = inner(tS) + 0.07;
  const H = Math.min(1.15, 1.3 * h);
  const top = ty + H;
  const reach = 0.42;
  const arch = useTube(
    [
      [tx, ty, -tz],
      [tx + 0.1, ty + 0.5 * H, -tz * 0.97],
      [tx + reach * 0.85, top - 0.06, -(tz - 0.12)],
      [tx + reach, top, 0],
      [tx + reach * 0.85, top - 0.06, tz - 0.12],
      [tx + 0.1, ty + 0.5 * H, tz * 0.97],
      [tx, ty, tz],
    ],
    0.042,
  );
  const brace = (sgn: number): V3[] => [
    [tx + reach * 0.8, top - 0.08, sgn * (tz - 0.16)],
    [tx - 0.2, ty + 0.55 * H, sgn * (tz - 0.05)],
    [x(0.3), at(0.3).sheerY, sgn * (inner(0.3) + 0.07)],
  ];
  const braceL = useTube(brace(-1), 0.032);
  const braceR = useTube(brace(1), 0.032);
  const towerMat = <Mat color={ACCENT} opacity={opacity} roughness={0.3} metalness={0.25} />;
  const hullMat = <Mat color={color} opacity={opacity} roughness={0.3} metalness={0.15} />;

  return (
    <group {...events}>
      <mesh geometry={geo.hull} castShadow receiveShadow userData={userData}>
        {hullMat}
        {outline && <Edges color={outline} threshold={25} />}
      </mesh>
      <mesh geometry={geo.transom} castShadow userData={userData}>
        {hullMat}
      </mesh>
      <mesh geometry={geo.gunwale} castShadow receiveShadow userData={userData}>
        {hullMat}
      </mesh>
      <mesh geometry={geo.accent} userData={userData}>
        <Mat color={ACCENT} opacity={opacity} roughness={0.35} metalness={0.2} />
      </mesh>
      <mesh geometry={geo.trim} userData={userData}>
        <Mat color={TRIM} opacity={opacity} roughness={0.5} />
      </mesh>
      <mesh geometry={geo.cockpit} receiveShadow userData={userData}>
        <Mat color={FLOOR} opacity={opacity} roughness={0.85} />
      </mesh>

      {/* Wrap-around seating aft, side seats, helm and passenger consoles, bow seating. */}
      {/* Inboard engine under a hatch aft, with a seat either side of it. */}
      {[-1, 1].map((sgn) => seat(COCKPIT[0] + 0.01, 0.17, sgn * hatchW / 2, sgn * inner(0.17), 'aft'))}
      <RoundedBox position={[(x(COCKPIT[0] + 0.01) + x(0.2)) / 2, f + seatH * 0.6, 0]} args={[x(0.2) - x(COCKPIT[0] + 0.01), seatH * 1.2, hatchW - 0.04]} radius={0.05} smoothness={3} castShadow>
        <Mat color="#2a2e33" opacity={opacity} roughness={0.5} />
      </RoundedBox>
      {[0.3, 0.45, 0.6, 0.75].map((k) => (
        <mesh key={k} position={[x(COCKPIT[0] + 0.01) + k * (x(0.2) - x(COCKPIT[0] + 0.01)), f + seatH * 1.205, 0]}>
          <boxGeometry args={[0.035, 0.01, hatchW * 0.6]} />
          <Mat color="#5b6168" opacity={opacity} />
        </mesh>
      ))}

      {/* Swim platform across the stern, on brackets from the transom. */}
      <RoundedBox position={[(-l / 2 + x(0) + 0.04) / 2, platformY, 0]} args={[x(0) + 0.04 + l / 2, 0.07, platformW]} radius={0.03} smoothness={3} castShadow receiveShadow userData={userData}>
        <Mat color="#9a8f82" opacity={opacity} roughness={0.9} />
      </RoundedBox>
      {[-1, 1].map((sgn) => (
        <mesh key={`bracket${sgn}`} position={[x(0) - 0.12, platformY - 0.07, sgn * platformW * 0.3]} castShadow>
          <boxGeometry args={[0.24, 0.08, 0.06]} />
          <Mat color={TRIM} opacity={opacity} />
        </mesh>
      ))}

      {/* Running gear under the hull: shaft from the engine, strut, propeller and rudder. */}
      <Bar a={[x(0.34), -h / 2 + 0.03, 0]} b={[x(0.1), -h / 2 - 0.08, 0]} r={0.022} color="#9aa1a8" opacity={opacity} />
      <mesh position={[x(0.2), -h / 2 - 0.03, 0]}>
        <boxGeometry args={[0.04, 0.1, 0.03]} />
        <Mat color={BRONZE} opacity={opacity} metalness={0.6} roughness={0.35} />
      </mesh>
      {[0, 1, 2, 3].map((k) => (
        <mesh key={`blade${k}`} position={[x(0.1), -h / 2 - 0.08, 0]} rotation={[(k * Math.PI) / 2 + 0.3, 0, 0]}>
          <boxGeometry args={[0.03, 0.15, 0.08]} />
          <Mat color={BRONZE} opacity={opacity} metalness={0.6} roughness={0.35} />
        </mesh>
      ))}
      <mesh position={[x(0.06), -h / 2 - 0.08, 0]}>
        <boxGeometry args={[0.16, 0.22, 0.02]} />
        <Mat color={BRONZE} opacity={opacity} metalness={0.6} roughness={0.35} />
      </mesh>
      {[-1, 1].map((sgn) => seat(0.17, 0.48, sgn * (inner(0.3) - seatW), sgn * inner(0.3), 'out'))}
      {[-1, 1].map((sgn) => (
        <group key={`console${sgn}`}>
          <RoundedBox position={[(x(0.58) + x(0.66)) / 2, f + 0.28, sgn * (inner(0.62) - 0.3)]} args={[x(0.66) - x(0.58), 0.56, 0.5]} radius={0.06} smoothness={3} castShadow>
            <Mat color={TRIM} opacity={opacity} roughness={0.45} />
          </RoundedBox>
          {sgn > 0 && (
            <mesh position={[x(0.58) - 0.02, f + 0.66, inner(0.62) - 0.3]} rotation={[0, Math.PI / 2, 0.5]}>
              <torusGeometry args={[0.17, 0.018, 10, 32]} />
              <Mat color={TRIM} opacity={opacity} roughness={0.4} />
            </mesh>
          )}
        </group>
      ))}
      {[-1, 1].map((sgn) => seat(0.69, COCKPIT[1] - 0.01, sgn * Math.max(0.12, inner(0.76) - seatW), sgn * inner(0.76), 'out'))}

      <mesh geometry={screen.glass}>
        <meshStandardMaterial color="#5d7183" roughness={0.05} metalness={0.6} transparent opacity={0.55 * opacity} depthWrite={false} side={THREE.DoubleSide} />
      </mesh>
      {screen.frames.map((pts, i) => (
        <Frame key={i} points={pts} opacity={opacity} />
      ))}

      <mesh geometry={arch} castShadow>
        {towerMat}
      </mesh>
      <mesh geometry={braceL} castShadow>
        {towerMat}
      </mesh>
      <mesh geometry={braceR} castShadow>
        {towerMat}
      </mesh>
      {[-1, 1].map((sgn) => (
        <mesh key={`speaker${sgn}`} position={[tx + reach * 0.62, top - 0.2, sgn * (tz - 0.3)]} rotation={[0, 0, Math.PI / 2]} castShadow>
          <cylinderGeometry args={[0.1, 0.12, 0.26, 20]} />
          <Mat color={TRIM} opacity={opacity} roughness={0.4} metalness={0.2} />
        </mesh>
      ))}
    </group>
  );
}

/** The windscreen's top edge. */
function Frame({ points, opacity }: { points: V3[]; opacity: number }) {
  const geo = useTube(points, 0.022);
  return (
    <mesh geometry={geo}>
      <Mat color="#c9ced3" opacity={opacity} roughness={0.2} metalness={0.8} />
    </mesh>
  );
}

/** Cowling above the transom, leg and gearcase below it. */
function Outboard({ size, color, opacity, outline, userData, events }: Omit<ShapeProps, 'shape'> & { events: Record<string, unknown> }) {
  const l = size.l / 1000;
  const w = size.w / 1000;
  const h = size.h / 1000;
  const cowl = h * 0.38;
  return (
    <group {...events}>
      <mesh position={[0, h / 2 - cowl / 2, 0]} castShadow userData={userData}>
        <boxGeometry args={[l, cowl, w]} />
        <Mat color={color} opacity={opacity} roughness={0.3} metalness={0.2} />
        {outline && <Edges color={outline} />}
      </mesh>
      <mesh position={[l * 0.1, -cowl / 2, 0]} castShadow userData={userData}>
        <boxGeometry args={[l * 0.32, h - cowl, w * 0.32]} />
        <Mat color="#1d1f22" opacity={opacity} />
      </mesh>
      <mesh position={[l * 0.1, -h / 2 + 0.05, 0]} castShadow userData={userData}>
        <boxGeometry args={[l * 0.7, 0.07, w * 0.3]} />
        <Mat color="#1d1f22" opacity={opacity} />
      </mesh>
    </group>
  );
}

export function ItemShapeMesh({ shape, size, color, opacity, outline, userData, ...events }: ShapeProps) {
  const l = size.l / 1000;
  const w = size.w / 1000;
  const h = size.h / 1000;
  if (shape === 'boat') return <BoatHull size={size} color={color} opacity={opacity} outline={outline} userData={userData} events={events} />;
  if (shape === 'outboard') return <Outboard size={size} color={color} opacity={opacity} outline={outline} userData={userData} events={events} />;
  if (shape === 'person') {
    return (
      <group {...events}>
        <mesh position={[-l * 0.12, h * 0.1, 0]} castShadow userData={userData}>
          <capsuleGeometry args={[w * 0.3, h * 0.36, 6, 16]} />
          <Mat color={color} opacity={opacity} />
          {outline && <Edges color={outline} />}
        </mesh>
        <mesh position={[-l * 0.08, h * 0.44, 0]} castShadow userData={userData}>
          <sphereGeometry args={[w * 0.22, 20, 14]} />
          <Mat color="#e2b48f" opacity={opacity} />
        </mesh>
        <mesh position={[l * 0.18, -h * 0.22, 0]} castShadow userData={userData}>
          <boxGeometry args={[l * 0.6, h * 0.14, w * 0.75]} />
          <Mat color="#3d4a5c" opacity={opacity} />
        </mesh>
      </group>
    );
  }
  if (shape === 'bullbar') {
    // Bottom pan, uprights and a centre hoop, so the grille and winch stay visible.
    const t = Math.min(0.065, l * 0.3);
    const pan = h * 0.42;
    const uprights = [-0.4, -0.13, 0.13, 0.4];
    return (
      <group {...events}>
        <mesh position={[0, -h / 2 + pan / 2, 0]} castShadow userData={userData}>
          <boxGeometry args={[l, pan, w]} />
          <Mat color={color} opacity={opacity} roughness={0.45} metalness={0.4} />
          {outline && <Edges color={outline} />}
        </mesh>
        <mesh position={[l * 0.15, h / 2 - t / 2, 0]} castShadow userData={userData}>
          <boxGeometry args={[t, t, w * 0.62]} />
          <Mat color={color} opacity={opacity} roughness={0.45} metalness={0.4} />
        </mesh>
        {uprights.map((f) => (
          <mesh key={f} position={[l * 0.15, -h / 2 + pan + (h - pan) / 2, w * f * (Math.abs(f) > 0.3 ? 0.78 : 1)]} castShadow userData={userData}>
            <boxGeometry args={[t, h - pan, t]} />
            <Mat color={color} opacity={opacity} roughness={0.45} metalness={0.4} />
          </mesh>
        ))}
        {[-1, 1].map((side) => (
          <mesh key={side} position={[0, -h / 2 + pan + t / 2, (side * w) / 2 - side * w * 0.09]} castShadow userData={userData}>
            <boxGeometry args={[l * 0.9, t, w * 0.18]} />
            <Mat color={color} opacity={opacity} roughness={0.45} metalness={0.4} />
          </mesh>
        ))}
      </group>
    );
  }
  if (shape === 'cylinder') {
    const axis = cylinderAxis(size);
    const [r, len, rot] =
      axis === 'z'
        ? [Math.max(l, w) / 2, h, [0, 0, 0]]
        : axis === 'x'
          ? [Math.max(w, h) / 2, l, [0, 0, Math.PI / 2]]
          : [Math.max(l, h) / 2, w, [Math.PI / 2, 0, 0]];
    return (
      <mesh rotation={rot as [number, number, number]} castShadow receiveShadow userData={userData} {...events}>
        <cylinderGeometry args={[r, r, len, 28]} />
        <Mat color={color} opacity={opacity} roughness={0.5} />
        {outline && <Edges color={outline} />}
      </mesh>
    );
  }
  return (
    <mesh castShadow receiveShadow userData={userData} {...events}>
      <boxGeometry args={[l, h, w]} />
      <Mat color={color} opacity={opacity} />
      {outline && <Edges color={outline} />}
    </mesh>
  );
}

function ItemMesh({ item, offset, selected }: { item: LoadItem; offset: number; selected: boolean }) {
  const controls = useThree((s) => s.controls) as unknown as { enabled: boolean } | null;
  const onPointerDown = (e: ThreeEvent<PointerEvent>) => {
    if (e.button !== 0) return;
    e.stopPropagation();
    const ui = useUi.getState();
    ui.select(item.id);
    ui.setDragging(item.id);
    if (controls) controls.enabled = false;
  };
  // People can't be stacked on; everything else is a drop target for other items.
  const userData = item.shape === 'person' ? { itemId: item.id } : { surface: 'item', host: item.host, itemId: item.id };
  return (
    <group position={toWorld(item.host, item.pos, offset)}>
      <ItemShapeMesh
        shape={item.shape}
        size={item.size}
        color={item.color}
        opacity={item.enabled ? 1 : 0.3}
        outline={selected ? '#ff7a00' : null}
        userData={userData}
        onPointerDown={onPointerDown}
        onPointerOver={(e) => {
          e.stopPropagation();
          document.body.style.cursor = 'grab';
        }}
        onPointerOut={() => {
          document.body.style.cursor = '';
        }}
      />
    </group>
  );
}

function MeasuredGhost({ item, offset }: { item: LoadItem; offset: number }) {
  const m = item.measured;
  if (!m) return null;
  const moved =
    m.host !== item.host || Math.hypot(m.pos.x - item.pos.x, m.pos.y - item.pos.y, m.pos.z - item.pos.z) > 5;
  if (!moved) return null;
  return (
    <group position={toWorld(m.host, m.pos, offset)}>
      <mesh>
        <boxGeometry args={[item.size.l / 1000, item.size.h / 1000, item.size.w / 1000]} />
        <meshBasicMaterial color="#6b7280" wireframe />
      </mesh>
      <Html center portal={labelLayer as RefObject<HTMLElement>} style={{ pointerEvents: 'none' }} zIndexRange={[10, 0]}>
        <div className="tag tag-muted">weighed here</div>
      </Html>
    </group>
  );
}

export function Items({ items, offset }: { items: LoadItem[]; offset: number }) {
  const selectedId = useUi((s) => s.selectedId);
  const selected = items.find((i) => i.id === selectedId);
  return (
    <group>
      {items.map((it) => (
        <ItemMesh key={it.id} item={it} offset={offset} selected={it.id === selectedId} />
      ))}
      {selected && <MeasuredGhost item={selected} offset={offset} />}
    </group>
  );
}

export function DropGhost({ offset }: { offset: number }) {
  const p = useUi((s) => s.dropPreview);
  if (!p) return null;
  return (
    <group position={toWorld(p.host, p.pos, offset)}>
      <ItemShapeMesh shape={p.shape} size={p.size} color={p.color} opacity={0.55} outline="#ff7a00" />
    </group>
  );
}
