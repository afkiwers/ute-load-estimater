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

/** Top view of a hull, bow at +x, centred on the origin (metres). */
function drawHull(p: THREE.Path, l: number, w: number) {
  const bow = l / 2;
  const stern = -l / 2;
  const beam = bow - 0.38 * l;
  p.moveTo(stern, -w * 0.46);
  p.lineTo(beam, -w / 2);
  p.quadraticCurveTo(bow - 0.04 * l, -w * 0.42, bow, 0);
  p.quadraticCurveTo(bow - 0.04 * l, w * 0.42, beam, w / 2);
  p.lineTo(stern, w * 0.46);
  p.lineTo(stern, -w * 0.46);
}

/** Lays an outline extruded along +z flat, extruding upwards instead. */
function standUp(g: THREE.BufferGeometry) {
  g.rotateX(-Math.PI / 2);
  return g;
}

/** Open boat: solid V-shaped hull up to the cockpit floor, gunwales above it, a console in the middle. */
function BoatHull({ size, color, opacity, outline, userData, events }: Omit<ShapeProps, 'shape'> & { events: Record<string, unknown> }) {
  const l = size.l / 1000;
  const w = size.w / 1000;
  const h = size.h / 1000;
  const geo = useMemo(() => {
    const floorH = h * BOAT_FLOOR;
    const outer = new THREE.Shape();
    drawHull(outer, l, w);
    const base = standUp(new THREE.ExtrudeGeometry(outer, { depth: floorH, bevelEnabled: false, curveSegments: 16 }));
    // Narrow the bottom towards a keel.
    const pos = base.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < pos.count; i++) {
      const t = pos.getY(i) / floorH;
      pos.setZ(i, pos.getZ(i) * (0.3 + 0.7 * t));
    }
    base.computeVertexNormals();
    base.translate(0, -h / 2, 0);

    const t = Math.min(0.05, w * 0.03);
    const ring = new THREE.Shape();
    drawHull(ring, l, w);
    const hole = new THREE.Path();
    drawHull(hole, l - 2.6 * t, w - 2 * t);
    ring.holes = [hole];
    const sides = standUp(new THREE.ExtrudeGeometry(ring, { depth: h - floorH, bevelEnabled: false, curveSegments: 16 }));
    sides.translate(0, -h / 2 + floorH, 0);
    const rail = standUp(new THREE.ExtrudeGeometry(ring, { depth: 0.035, bevelEnabled: false, curveSegments: 16 }));
    rail.translate(0, h / 2 - 0.02, 0);
    return { base, sides, rail, floorY: -h / 2 + floorH };
  }, [l, w, h]);
  useEffect(() => () => [geo.base, geo.sides, geo.rail].forEach((g) => g.dispose()), [geo]);
  const consoleH = Math.min(0.75, h * 0.8);
  return (
    <group {...events}>
      <mesh geometry={geo.base} castShadow receiveShadow userData={userData}>
        <Mat color={color} opacity={opacity} roughness={0.35} metalness={0.3} />
        {outline && <Edges color={outline} threshold={30} />}
      </mesh>
      <mesh geometry={geo.sides} castShadow userData={userData}>
        <Mat color={color} opacity={opacity} roughness={0.35} metalness={0.3} />
      </mesh>
      <mesh geometry={geo.rail}>
        <Mat color="#2b2f35" opacity={opacity} />
      </mesh>
      <mesh position={[-l * 0.02, geo.floorY + consoleH / 2, 0]} castShadow userData={userData}>
        <boxGeometry args={[0.55, consoleH, 0.5]} />
        <Mat color="#3a4048" opacity={opacity} />
      </mesh>
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
