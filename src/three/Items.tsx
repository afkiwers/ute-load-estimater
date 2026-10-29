import { useEffect, useMemo, type RefObject } from 'react';
import * as THREE from 'three';
import { Edges, Html } from '@react-three/drei';
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

/** Cross-section of the hull at a share s of its length from the transom (0) to the bow (1), in metres around the box centre. */
interface Section {
  x: number;
  /** Right side from the keel up to the sheer, as [height, half-width]; the left side mirrors it. */
  side: [number, number][];
  /** Index in `side` where the accent stripe starts; it runs to the next point. */
  stripe: number;
  sheerY: number;
  halfBeam: number;
}

function hullSection(s: number, l: number, w: number, h: number): Section {
  const x = -l / 2 + s * l;
  // Full beam aft, a fine pointed bow.
  const halfBeam = s <= 0.5 ? (w / 2) * (0.93 + 0.07 * (s / 0.5)) : (w / 2) * (1 - Math.pow((s - 0.5) / 0.5, 2.2));
  const sheerY = h / 2 - 0.1 * h * (1 - s);
  const bow = Math.max(0, (s - 0.55) / 0.45);
  const keelY = -h / 2 + 0.6 * h * bow * bow;
  // Deep V up to a hard chine, then a knuckle (the widest line) with the accent stripe just below it.
  const chineY = keelY + 0.24 * h * (1 - 0.4 * bow);
  const knuckleY = chineY + (sheerY - chineY) * 0.5;
  const stripeY = knuckleY - Math.min(0.07, 0.3 * (knuckleY - chineY));
  const t = (stripeY - chineY) / (knuckleY - chineY || 1);
  const chineZ = 0.8 * halfBeam;
  return {
    x,
    side: [
      [keelY, 0],
      [chineY, chineZ],
      [stripeY, chineZ + (halfBeam - chineZ) * t],
      [knuckleY, halfBeam],
      [sheerY, 0.98 * halfBeam],
    ],
    stripe: 2,
    sheerY,
    halfBeam,
  };
}

/** Joins point lists at successive stations with quads; each list runs so the faces' fronts point outwards. */
function skin(rows: V3[][], out: number[], from = 0, to = Infinity) {
  for (let j = 0; j + 1 < rows.length; j++) {
    const a = rows[j];
    const b = rows[j + 1];
    for (let i = from; i + 1 < a.length && i < to; i++) out.push(...a[i], ...b[i], ...b[i + 1], ...a[i], ...b[i + 1], ...a[i + 1]);
  }
}

function geometry(pos: number[]) {
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.computeVertexNormals();
  return g;
}

/** Stations along the hull, closer together where the cockpit starts and ends so its walls stay upright. */
const COCKPIT: [number, number] = [0.08, 0.84];
const STATIONS = [0, 0.04, COCKPIT[0], COCKPIT[0] + 0.004, 0.2, 0.32, 0.44, 0.55, 0.64, 0.72, 0.78, COCKPIT[1], COCKPIT[1] + 0.004, 0.88, 0.92, 0.95, 0.975, 0.99, 1];

/** Hull, deck with a recessed cockpit, and transom, as flat-shaded faces (metres, bow at +x, centred on the item box). */
function hullGeometry(l: number, w: number, h: number) {
  const floorY = -h / 2 + h * BOAT_FLOOR;
  const sections = STATIONS.map((s) => ({ s, ...hullSection(s, l, w, h) }));
  const right = sections.map((c) => c.side.map(([y, z]) => [c.x, y, z] as V3));
  // The left side runs the other way round so its faces point out too.
  const left = sections.map((c) => c.side.map(([y, z]) => [c.x, y, -z] as V3).reverse());
  const hull: number[] = [];
  const stripe: number[] = [];
  const n = sections[0].side.length;
  const k = sections[0].stripe;
  skin(right, hull, 0, k);
  skin(right, stripe, k, k + 1);
  skin(right, hull, k + 1);
  skin(left, hull, 0, n - 2 - k);
  skin(left, stripe, n - 2 - k, n - 1 - k);
  skin(left, hull, n - 1 - k);

  // Deck from the right sheer to the left: gunwale, down into the cockpit where there is one, across, and up again.
  const deck: number[] = [];
  const deckRows = sections.map((c) => {
    const edge = 0.98 * c.halfBeam;
    const inner = Math.max(0, edge - Math.min(0.17, 0.3 * edge));
    const open = c.s > COCKPIT[0] && c.s <= COCKPIT[1];
    const fy = open ? floorY : c.sheerY;
    return [
      [c.x, c.sheerY, edge],
      [c.x, c.sheerY, inner],
      [c.x, fy, inner],
      [c.x, fy, -inner],
      [c.x, c.sheerY, -inner],
      [c.x, c.sheerY, -edge],
    ] as V3[];
  });
  skin(deckRows, deck);

  // Transom: a fan around the stern outline, facing aft.
  const transom: number[] = [];
  const ring = [...right[0], ...left[0]];
  const c: V3 = [-l / 2, (ring[0][1] + sections[0].sheerY) / 2, 0];
  for (let i = 0; i < ring.length; i++) transom.push(...c, ...ring[i], ...ring[(i + 1) % ring.length]);

  return { hull: geometry(hull), stripe: geometry(stripe), deck: geometry(deck), transom: geometry(transom), floorY, sections };
}

/** A round bar between two points (metres). */
function Bar({ a, b, r, color, opacity }: { a: V3; b: V3; r: number; color: string; opacity: number }) {
  const va = new THREE.Vector3(...a);
  const vb = new THREE.Vector3(...b);
  const dir = vb.clone().sub(va);
  const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.clone().normalize());
  return (
    <mesh position={va.add(vb).multiplyScalar(0.5)} quaternion={q} castShadow>
      <cylinderGeometry args={[r, r, dir.length(), 14]} />
      <Mat color={color} opacity={opacity} roughness={0.3} metalness={0.4} />
    </mesh>
  );
}

const ACCENT = '#c41e2c';
const UPHOLSTERY = '#e4e6e8';
const TRIM = '#1e2125';
const DECK = '#5b6168';

/**
 * Fibreglass bowrider: deep V hull with hard chines and an accent stripe, a cockpit recessed to the floor height the
 * palette places gear on, seats, a windscreen and a wakeboard tower. The hull colour is the item's.
 */
function BoatHull({ size, color, opacity, outline, userData, events }: Omit<ShapeProps, 'shape'> & { events: Record<string, unknown> }) {
  const l = size.l / 1000;
  const w = size.w / 1000;
  const h = size.h / 1000;
  const geo = useMemo(() => hullGeometry(l, w, h), [l, w, h]);
  useEffect(() => () => [geo.hull, geo.stripe, geo.deck, geo.transom].forEach((g) => g.dispose()), [geo]);

  const at = (s: number) => hullSection(s, l, w, h);
  const x = (s: number) => -l / 2 + s * l;
  const inner = (s: number) => 0.98 * at(s).halfBeam - Math.min(0.17, 0.3 * 0.98 * at(s).halfBeam);
  const f = geo.floorY;
  const seatH = Math.min(0.42, (at(0.3).sheerY - f) * 0.85);
  const seat = (s0: number, s1: number, z0: number, z1: number, key: string) => (
    <group key={key}>
      <mesh position={[(x(s0) + x(s1)) / 2, f + seatH * 0.4, (z0 + z1) / 2]} castShadow>
        <boxGeometry args={[x(s1) - x(s0), seatH * 0.8, Math.abs(z1 - z0)]} />
        <Mat color={ACCENT} opacity={opacity} roughness={0.7} />
      </mesh>
      <mesh position={[(x(s0) + x(s1)) / 2, f + seatH * 0.9, (z0 + z1) / 2]} castShadow>
        <boxGeometry args={[x(s1) - x(s0) - 0.02, seatH * 0.2, Math.abs(z1 - z0) - 0.02]} />
        <Mat color={UPHOLSTERY} opacity={opacity} roughness={0.8} />
      </mesh>
    </group>
  );
  const side = 0.38;
  const towerS = 0.42;
  const towerTop = at(towerS).sheerY + Math.min(1.05, 1.2 * h);
  const legZ = inner(towerS) + 0.05;
  const screenS = 0.66;
  const screenZ = inner(screenS);
  const screenH = Math.min(0.38, 0.45 * h);

  return (
    <group {...events}>
      <mesh geometry={geo.hull} castShadow receiveShadow userData={userData}>
        <Mat color={color} opacity={opacity} roughness={0.5} metalness={0.05} />
        {outline && <Edges color={outline} threshold={25} />}
      </mesh>
      <mesh geometry={geo.stripe} userData={userData}>
        <Mat color={ACCENT} opacity={opacity} roughness={0.3} metalness={0.3} />
      </mesh>
      <mesh geometry={geo.transom} castShadow userData={userData}>
        <Mat color={color} opacity={opacity} roughness={0.5} metalness={0.05} />
      </mesh>
      <mesh geometry={geo.deck} castShadow receiveShadow userData={userData}>
        <Mat color={DECK} opacity={opacity} roughness={0.8} />
      </mesh>

      {/* Stern bench, side seats, the helm and passenger consoles, and bow seats. */}
      {seat(COCKPIT[0] + 0.01, 0.19, -inner(0.19), inner(0.19), 'stern')}
      {[-1, 1].map((sgn) => seat(0.19, 0.44, sgn * (inner(0.3) - side), sgn * inner(0.3), `side${sgn}`))}
      {[-1, 1].map((sgn) => (
        <mesh key={`console${sgn}`} position={[(x(0.58) + x(0.65)) / 2, f + 0.27, sgn * (screenZ - 0.3)]} castShadow>
          <boxGeometry args={[x(0.65) - x(0.58), 0.54, 0.46]} />
          <Mat color={TRIM} opacity={opacity} />
        </mesh>
      ))}
      {[-1, 1].map((sgn) => seat(0.7, COCKPIT[1] - 0.01, sgn * Math.max(0.15, inner(0.8) - 0.4), sgn * inner(0.8), `bow${sgn}`))}

      {/* Wrap-around windscreen with a walk-through in the middle. */}
      {[-1, 1].map((sgn) => (
        <mesh key={`screen${sgn}`} position={[x(screenS), at(screenS).sheerY + screenH / 2 - 0.02, sgn * (screenZ + 0.25) / 2]} rotation={[sgn * 0.08, 0, 0.45]}>
          <boxGeometry args={[0.03, screenH, screenZ - 0.25]} />
          <meshStandardMaterial color="#14181c" roughness={0.1} metalness={0.3} transparent opacity={0.88 * opacity} depthWrite={false} />
        </mesh>
      ))}

      {/* Wakeboard tower: legs on the gunwales, a crossbar with speakers, braces forward. */}
      {[-1, 1].map((sgn) => (
        <group key={`tower${sgn}`}>
          <Bar a={[x(towerS), at(towerS).sheerY, sgn * legZ]} b={[x(towerS) + 0.3, towerTop, sgn * (legZ - 0.12)]} r={0.035} color={ACCENT} opacity={opacity} />
          <Bar a={[x(towerS + 0.16), at(towerS + 0.16).sheerY, sgn * (inner(towerS + 0.16) + 0.04)]} b={[x(towerS) + 0.3, towerTop, sgn * (legZ - 0.12)]} r={0.03} color={ACCENT} opacity={opacity} />
          <mesh position={[x(towerS) + 0.3, towerTop - 0.12, sgn * (legZ - 0.35)]} rotation={[0, 0, Math.PI / 2]} castShadow>
            <cylinderGeometry args={[0.09, 0.09, 0.22, 18]} />
            <Mat color={TRIM} opacity={opacity} roughness={0.4} />
          </mesh>
        </group>
      ))}
      <Bar a={[x(towerS) + 0.3, towerTop, -(legZ - 0.12)]} b={[x(towerS) + 0.3, towerTop, legZ - 0.12]} r={0.04} color={ACCENT} opacity={opacity} />
    </group>
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
