// Building blocks for the detailed vehicle models: shared materials, rounded
// parts, struts between two points, slanted panels and the wheel.

import { useEffect, useMemo } from 'react';
import { RoundedBox } from '@react-three/drei';
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import type { Host } from '../model/types';
import { toWorld } from '../model/geometry';
import { boxWorld, surfaceData, type BoxMm } from './parts';

export interface Materials {
  paint: THREE.MeshPhysicalMaterial;
  gloss: THREE.MeshPhysicalMaterial;
  /** Gloss black that renders from both sides, for thin panels. */
  trim: THREE.MeshPhysicalMaterial;
  plastic: THREE.MeshStandardMaterial;
  chrome: THREE.MeshStandardMaterial;
  brushed: THREE.MeshStandardMaterial;
  glass: THREE.MeshPhysicalMaterial;
  lens: THREE.MeshPhysicalMaterial;
  led: THREE.MeshStandardMaterial;
  red: THREE.MeshStandardMaterial;
  amber: THREE.MeshStandardMaterial;
  interior: THREE.MeshStandardMaterial;
  bedliner: THREE.MeshStandardMaterial;
  chassis: THREE.MeshStandardMaterial;
}

/** Materials for one vehicle; in x-ray mode the exterior turns into a faint ghost. */
export function useMaterials(paint: string, xray: boolean): Materials {
  const mats = useMemo(() => {
    const ghost = (m: THREE.Material) => {
      if (xray) {
        m.transparent = true;
        m.opacity = 0.12;
        m.depthWrite = false;
      }
      return m;
    };
    return {
      paint: ghost(
        new THREE.MeshPhysicalMaterial({ color: paint, metalness: 0.45, roughness: 0.32, clearcoat: 1, clearcoatRoughness: 0.06 }),
      ) as THREE.MeshPhysicalMaterial,
      gloss: ghost(
        new THREE.MeshPhysicalMaterial({ color: '#0a0b0d', metalness: 0.2, roughness: 0.3, clearcoat: 0.6, clearcoatRoughness: 0.15, envMapIntensity: 0.45 }),
      ) as THREE.MeshPhysicalMaterial,
      trim: ghost(
        new THREE.MeshPhysicalMaterial({ color: '#0a0b0d', metalness: 0.2, roughness: 0.3, clearcoat: 0.6, clearcoatRoughness: 0.15, envMapIntensity: 0.45, side: THREE.DoubleSide }),
      ) as THREE.MeshPhysicalMaterial,
      plastic: ghost(new THREE.MeshStandardMaterial({ color: '#1c1e21', roughness: 0.82, metalness: 0 })) as THREE.MeshStandardMaterial,
      chrome: ghost(new THREE.MeshStandardMaterial({ color: '#e4e7ea', metalness: 1, roughness: 0.12 })) as THREE.MeshStandardMaterial,
      brushed: ghost(new THREE.MeshStandardMaterial({ color: '#aab0b7', metalness: 0.85, roughness: 0.35 })) as THREE.MeshStandardMaterial,
      glass: new THREE.MeshPhysicalMaterial({
        color: '#080b0f',
        metalness: 0,
        roughness: 0.06,
        transparent: true,
        opacity: xray ? 0 : 0.86,
        depthWrite: false,
        side: THREE.DoubleSide,
        envMapIntensity: 0.3,
        specularIntensity: 0.5,
      }),
      lens: new THREE.MeshPhysicalMaterial({ color: '#ffffff', metalness: 0, roughness: 0.02, transparent: true, opacity: xray ? 0.05 : 0.18, depthWrite: false }),
      led: ghost(new THREE.MeshStandardMaterial({ color: '#ffffff', emissive: '#e9f3ff', emissiveIntensity: 2.2, toneMapped: false })) as THREE.MeshStandardMaterial,
      red: ghost(new THREE.MeshStandardMaterial({ color: '#7a0008', emissive: '#ff1a1a', emissiveIntensity: 1.3, roughness: 0.3, toneMapped: false })) as THREE.MeshStandardMaterial,
      amber: ghost(new THREE.MeshStandardMaterial({ color: '#8a4a00', emissive: '#ff8a00', emissiveIntensity: 1.1, roughness: 0.3, toneMapped: false })) as THREE.MeshStandardMaterial,
      interior: new THREE.MeshStandardMaterial({ color: '#2a2d32', roughness: 0.85 }),
      bedliner: new THREE.MeshStandardMaterial({ color: '#1e1f21', roughness: 0.95 }),
      chassis: ghost(new THREE.MeshStandardMaterial({ color: '#17181a', roughness: 0.7, metalness: 0.3 })) as THREE.MeshStandardMaterial,
    };
  }, [paint, xray]);
  useEffect(() => () => Object.values(mats).forEach((m) => m.dispose()), [mats]);
  return mats;
}

interface RBoxProps {
  b: BoxMm;
  r?: number;
  material: THREE.Material;
  host?: Host;
  offset?: number;
  surface?: string | null;
  shadow?: boolean;
  rotation?: [number, number, number];
}

/** Box with rounded edges, given by its extents in a host frame (mm). */
export function RBox({ b, r = 20, material, host = 'ute', offset = 0, surface = null, shadow = true, rotation }: RBoxProps) {
  const { position, args } = boxWorld(host, b, offset);
  const radius = Math.min(r / 1000, Math.min(...args) / 2 - 0.0005);
  return (
    <RoundedBox
      args={args}
      radius={Math.max(radius, 0.0005)}
      smoothness={3}
      position={position}
      rotation={rotation}
      material={material}
      castShadow={shadow}
      receiveShadow
      userData={surfaceData(surface, host)}
    />
  );
}

type P3 = { x: number; y: number; z: number };

/** Rectangular bar between two host-frame points (mm), e.g. a pillar or a rail. */
export function Strut({ a, b, w, d, material, host = 'ute', offset = 0, surface = null }: { a: P3; b: P3; w: number; d: number; material: THREE.Material; host?: Host; offset?: number; surface?: string | null }) {
  const pa = new THREE.Vector3(...toWorld(host, a, offset));
  const pb = new THREE.Vector3(...toWorld(host, b, offset));
  const dir = pb.clone().sub(pa);
  const len = dir.length();
  const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.normalize());
  return (
    <mesh position={pa.add(pb).multiplyScalar(0.5)} quaternion={q} material={material} castShadow userData={surfaceData(surface, host)}>
      <boxGeometry args={[w / 1000, len, d / 1000]} />
    </mesh>
  );
}

/**
 * Flat panel drawn as a 2D outline (with optional holes) and then mapped into
 * 3D, so it can lean like cab glass. `map` turns an outline point into a host-frame point.
 */
export function usePanel(
  outline: [number, number][],
  holes: [number, number][][],
  map: (u: number, v: number) => P3,
  /** Values `map` depends on; the panel is rebuilt when they change. */
  mapDeps: number[],
  host: Host = 'ute',
  offset = 0,
) {
  const key = JSON.stringify([outline, holes, mapDeps]);
  const geo = useMemo(() => {
    const shape = new THREE.Shape(outline.map(([u, v]) => new THREE.Vector2(u, v)));
    shape.holes = holes.map((h) => new THREE.Path(h.map(([u, v]) => new THREE.Vector2(u, v))));
    const g = new THREE.ShapeGeometry(shape);
    const pos = g.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < pos.count; i++) {
      const [x, y, z] = toWorld(host, map(pos.getX(i), pos.getY(i)), offset);
      pos.setXYZ(i, x, y, z);
    }
    g.computeVertexNormals();
    return g;
  }, [key, host, offset]);
  useEffect(() => () => geo.dispose(), [geo]);
  return geo;
}

/** Side profile (x, z in mm) extruded across the width with rounded (bevelled) edges, centred on the centreline. */
export function useBevelProfile(points: [number, number][], widthMm: number, bevelMm: number) {
  const key = JSON.stringify(points);
  const geo = useMemo(() => {
    const shape = new THREE.Shape(
      points.map(([x, z]) => {
        const [wx, wy] = toWorld('ute', { x, y: 0, z }, 0);
        return new THREE.Vector2(wx, wy);
      }),
    );
    const b = bevelMm / 1000;
    const depth = widthMm / 1000 - 2 * b;
    const g = new THREE.ExtrudeGeometry(shape, {
      depth,
      bevelEnabled: true,
      bevelThickness: b,
      bevelSize: b,
      bevelOffset: -b,
      bevelSegments: 5,
      curveSegments: 24,
    });
    g.translate(0, 0, -depth / 2);
    g.computeVertexNormals();
    return g;
  }, [key, widthMm, bevelMm]);
  useEffect(() => () => geo.dispose(), [geo]);
  return geo;
}

/** Rounded-rectangle ring (e.g. a grille surround) in the y–z plane, extruded along x. */
export function useRingRect(w: number, h: number, thick: number, r: number, depth: number) {
  return useMemo(() => {
    const rr = (hw: number, hh: number, rad: number) => {
      const p = new THREE.Shape();
      p.moveTo(-hw + rad, -hh);
      p.lineTo(hw - rad, -hh);
      p.quadraticCurveTo(hw, -hh, hw, -hh + rad);
      p.lineTo(hw, hh - rad);
      p.quadraticCurveTo(hw, hh, hw - rad, hh);
      p.lineTo(-hw + rad, hh);
      p.quadraticCurveTo(-hw, hh, -hw, hh - rad);
      p.lineTo(-hw, -hh + rad);
      p.quadraticCurveTo(-hw, -hh, -hw + rad, -hh);
      return p;
    };
    const outer = rr(w / 2000, h / 2000, r / 1000);
    const inner = rr(w / 2000 - thick / 1000, h / 2000 - thick / 1000, Math.max(0.001, (r - thick * 0.6) / 1000));
    outer.holes = [inner];
    const g = new THREE.ExtrudeGeometry(outer, { depth: depth / 1000, bevelEnabled: true, bevelThickness: 0.006, bevelSize: 0.006, bevelSegments: 2 });
    g.translate(0, 0, -depth / 2000);
    return g;
  }, [w, h, thick, r, depth]);
}

// ---------- Wheel ----------

export type WheelStyle = 'at' | 'highway';

interface WheelGeo {
  tyre: THREE.BufferGeometry;
  tread: THREE.BufferGeometry | null;
  barrel: THREE.BufferGeometry;
  spokes: THREE.BufferGeometry;
  faces: THREE.BufferGeometry;
  hub: THREE.BufferGeometry;
  disc: THREE.BufferGeometry;
  caliper: THREE.BufferGeometry | null;
}

const wheelCache = new Map<string, WheelGeo>();

function wheelGeometry(R: number, W: number, rimR: number, style: WheelStyle): WheelGeo {
  const key = [R, W, rimR, style].map((v) => (typeof v === 'number' ? v.toFixed(4) : v)).join('|');
  const hit = wheelCache.get(key);
  if (hit) return hit;
  const sh = Math.min(0.05, W * 0.18);
  // Tyre cross-section revolved around the axle, with rounded shoulders.
  const profile = [
    [rimR - 0.004, -W / 2 + 0.012],
    [R - sh * 1.7, -W / 2],
    [R - sh * 0.55, -W / 2 + sh * 0.3],
    [R, -W / 2 + sh],
    [R, W / 2 - sh],
    [R - sh * 0.55, W / 2 - sh * 0.3],
    [R - sh * 1.7, W / 2],
    [rimR - 0.004, W / 2 - 0.012],
  ].map(([r, y]) => new THREE.Vector2(r, y));
  const tyre = new THREE.LatheGeometry(profile, 72);
  tyre.rotateX(Math.PI / 2);

  let tread: THREE.BufferGeometry | null = null;
  if (style === 'at') {
    const parts: THREE.BufferGeometry[] = [];
    const n = 34;
    for (let i = 0; i < n; i++) {
      for (const [k, zc, len, depth, rr] of [
        [0, -W * 0.22, W * 0.36, 0.016, R - 0.004],
        [0.5, W * 0.22, W * 0.36, 0.016, R - 0.004],
        [0, -W / 2 + sh * 0.35, sh * 0.9, 0.02, R - sh * 0.45],
        [0.5, W / 2 - sh * 0.35, sh * 0.9, 0.02, R - sh * 0.45],
      ] as const) {
        const a = ((i + k) / n) * Math.PI * 2;
        const box = new THREE.BoxGeometry(depth, 0.05, len);
        box.rotateZ(a);
        box.translate(Math.cos(a) * rr, Math.sin(a) * rr, zc);
        parts.push(box);
      }
    }
    tread = mergeGeometries(parts);
    parts.forEach((p) => p.dispose());
  }

  const barrel = new THREE.CylinderGeometry(rimR, rimR, W * 0.78, 48, 1, true);
  barrel.rotateX(Math.PI / 2);

  const faceZ = W * 0.32;
  const spokeParts: THREE.BufferGeometry[] = [];
  const faceParts: THREE.BufferGeometry[] = [];
  const spokes = style === 'at' ? 10 : 5;
  const hubR = rimR * 0.3;
  for (let i = 0; i < spokes; i++) {
    const a = (i / spokes) * Math.PI * 2;
    const len = rimR - hubR - 0.006;
    const width = style === 'at' ? 0.03 : 0.06;
    const s = new THREE.BoxGeometry(len, width, 0.03);
    s.translate(hubR + len / 2, 0, 0);
    s.rotateZ(a);
    s.translate(0, 0, faceZ);
    spokeParts.push(s);
    // Machined face along each spoke for the two-tone look.
    const f = new THREE.BoxGeometry(len * 0.92, width * 0.45, 0.004);
    f.translate(hubR + len * 0.5, 0, 0);
    f.rotateZ(a);
    f.translate(0, 0, faceZ + 0.017);
    faceParts.push(f);
  }
  const lip = new THREE.TorusGeometry(rimR - 0.006, 0.011, 10, 64);
  lip.translate(0, 0, faceZ + 0.006);
  faceParts.push(lip);
  const spokesGeo = mergeGeometries(spokeParts);
  const facesGeo = mergeGeometries(faceParts);
  spokeParts.concat(faceParts).forEach((p) => p.dispose());

  const hubParts: THREE.BufferGeometry[] = [];
  const hubDisc = new THREE.CylinderGeometry(hubR, hubR * 1.05, 0.05, 32);
  hubDisc.rotateX(Math.PI / 2);
  hubDisc.translate(0, 0, faceZ + 0.005);
  hubParts.push(hubDisc);
  const cap = new THREE.CylinderGeometry(hubR * 0.42, hubR * 0.42, 0.02, 24);
  cap.rotateX(Math.PI / 2);
  cap.translate(0, 0, faceZ + 0.035);
  hubParts.push(cap);
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    const nut = new THREE.CylinderGeometry(0.009, 0.009, 0.016, 8);
    nut.rotateX(Math.PI / 2);
    nut.translate(Math.cos(a) * hubR * 0.72, Math.sin(a) * hubR * 0.72, faceZ + 0.032);
    hubParts.push(nut);
  }
  const hub = mergeGeometries(hubParts);
  hubParts.forEach((p) => p.dispose());

  const disc = new THREE.CylinderGeometry(rimR * 0.8, rimR * 0.8, 0.026, 40);
  disc.rotateX(Math.PI / 2);
  disc.translate(0, 0, W * 0.06);

  let caliper: THREE.BufferGeometry | null = null;
  if (style === 'at') {
    caliper = new THREE.BoxGeometry(0.075, rimR * 0.55, 0.06);
    caliper.translate(rimR * 0.62, 0, W * 0.13);
    caliper.rotateZ(Math.PI * 0.15);
  }

  const geo = { tyre, tread, barrel, spokes: spokesGeo, faces: facesGeo, hub, disc, caliper };
  wheelCache.set(key, geo);
  return geo;
}

const wheelMats = {
  rubber: new THREE.MeshStandardMaterial({ color: '#1b1c1e', roughness: 0.93, side: THREE.DoubleSide }),
  rimDark: new THREE.MeshStandardMaterial({ color: '#26282c', metalness: 0.75, roughness: 0.33, side: THREE.DoubleSide }),
  rimSilver: new THREE.MeshStandardMaterial({ color: '#c3c8ce', metalness: 0.9, roughness: 0.25, side: THREE.DoubleSide }),
  machined: new THREE.MeshStandardMaterial({ color: '#d5d9de', metalness: 1, roughness: 0.2 }),
  disc: new THREE.MeshStandardMaterial({ color: '#7d8186', metalness: 0.8, roughness: 0.45 }),
  caliper: new THREE.MeshStandardMaterial({ color: '#d14b16', metalness: 0.3, roughness: 0.4 }),
};

interface WheelProps {
  host: Host;
  offset: number;
  x: number;
  y: number;
  /** Radii and widths in mm. */
  r: number;
  rimR: number;
  width: number;
  style?: WheelStyle;
}

/** Tyre, two-tone multi-spoke rim and brake, with the face turned outward on either side. */
export function Wheel({ host, offset, x, y, r, rimR, width, style = 'at' }: WheelProps) {
  const g = wheelGeometry(r / 1000, width / 1000, Math.min(rimR, r * 0.85) / 1000, style);
  const position = toWorld(host, { x, y, z: r }, offset);
  const rim = style === 'at' ? wheelMats.rimDark : wheelMats.rimSilver;
  return (
    <group position={position} rotation={[0, y < 0 ? Math.PI : 0, 0]}>
      <mesh geometry={g.tyre} material={wheelMats.rubber} castShadow receiveShadow />
      {g.tread && <mesh geometry={g.tread} material={wheelMats.rubber} castShadow />}
      <mesh geometry={g.barrel} material={rim} />
      <mesh geometry={g.spokes} material={rim} castShadow />
      <mesh geometry={g.faces} material={style === 'at' ? wheelMats.machined : rim} />
      <mesh geometry={g.hub} material={wheelMats.machined} />
      <mesh geometry={g.disc} material={wheelMats.disc} />
      {g.caliper && <mesh geometry={g.caliper} material={wheelMats.caliper} />}
    </group>
  );
}
