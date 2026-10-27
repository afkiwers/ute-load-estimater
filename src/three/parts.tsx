import { useMemo, type ReactNode } from 'react';
import * as THREE from 'three';
import type { Host } from '../model/types';
import { toWorld } from '../model/geometry';

/** Axis-aligned box in a host frame (mm). */
export interface BoxMm {
  x0: number;
  x1: number;
  y0: number;
  y1: number;
  z0: number;
  z1: number;
}

export function boxWorld(host: Host, b: BoxMm, offset: number) {
  const position = toWorld(host, { x: (b.x0 + b.x1) / 2, y: (b.y0 + b.y1) / 2, z: (b.z0 + b.z1) / 2 }, offset);
  const args: [number, number, number] = [
    Math.abs(b.x1 - b.x0) / 1000,
    Math.abs(b.z1 - b.z0) / 1000,
    Math.abs(b.y1 - b.y0) / 1000,
  ];
  return { position, args };
}

export function surfaceData(surface: string | null, host: Host) {
  return surface ? { surface, host } : {};
}

interface MatProps {
  color: string;
  opacity?: number;
  roughness?: number;
  metalness?: number;
  emissive?: string;
  emissiveIntensity?: number;
}

export function Mat({ color, opacity = 1, roughness = 0.6, metalness = 0.05, emissive, emissiveIntensity }: MatProps) {
  return (
    <meshStandardMaterial
      color={color}
      roughness={roughness}
      metalness={metalness}
      transparent={opacity < 1}
      opacity={opacity}
      depthWrite={opacity >= 1}
      emissive={emissive}
      emissiveIntensity={emissiveIntensity}
    />
  );
}

interface BlockProps extends MatProps {
  b: BoxMm;
  host?: Host;
  offset?: number;
  surface?: string | null;
  shadow?: boolean;
  children?: ReactNode;
}

export function Block({ b, host = 'ute', offset = 0, surface = null, shadow = true, children, ...mat }: BlockProps) {
  const { position, args } = boxWorld(host, b, offset);
  return (
    <mesh position={position} castShadow={shadow} receiveShadow userData={surfaceData(surface, host)}>
      <boxGeometry args={args} />
      <Mat {...mat} />
      {children}
    </mesh>
  );
}

/**
 * Extrudes a side profile given as (x, z) points in a host frame (mm) across
 * the vehicle width, centred on the centreline.
 */
export function useProfile(points: [number, number][], widthMm: number, host: Host = 'ute', offset = 0) {
  return useMemo(() => {
    const shape = new THREE.Shape(
      points.map(([x, z]) => {
        const [wx, wy] = toWorld(host, { x, y: 0, z }, offset);
        return new THREE.Vector2(wx, wy);
      }),
    );
    const geo = new THREE.ExtrudeGeometry(shape, { depth: widthMm / 1000, bevelEnabled: false, curveSegments: 20 });
    geo.translate(0, 0, -widthMm / 2000);
    geo.computeVertexNormals();
    return geo;
    // Points are rebuilt every render; their JSON is a cheap, stable key.
  }, [JSON.stringify(points), widthMm, host, offset]);
}

/** Points along a wheel arch, from the rear intersection with z = zLine over the top to the front one. */
export function archPoints(cx: number, cz: number, r: number, zLine: number, steps = 18): [number, number][] {
  const dz = zLine - cz;
  const clamped = Math.max(-r + 1, Math.min(r - 1, dz));
  const t0 = Math.asin(clamped / r);
  const pts: [number, number][] = [];
  for (let i = 0; i <= steps; i++) {
    const t = t0 + ((Math.PI - 2 * t0) * i) / steps;
    pts.push([cx + r * Math.cos(t), cz + r * Math.sin(t)]);
  }
  return pts;
}

/** Ring sector (wheel arch flare / well liner) extruded across a width. */
export function useArchFlare(cx: number, cz: number, rInner: number, rOuter: number, zLine: number, widthMm: number) {
  return useMemo(() => {
    const outer = archPoints(cx, cz, rOuter, zLine);
    const inner = archPoints(cx, cz, rInner, zLine).reverse();
    const shape = new THREE.Shape(
      [...outer, ...inner].map(([x, z]) => {
        const [wx, wy] = toWorld('ute', { x, y: 0, z }, 0);
        return new THREE.Vector2(wx, wy);
      }),
    );
    const geo = new THREE.ExtrudeGeometry(shape, { depth: widthMm / 1000, bevelEnabled: false });
    geo.translate(0, 0, -widthMm / 2000);
    geo.computeVertexNormals();
    return geo;
  }, [cx, cz, rInner, rOuter, zLine, widthMm]);
}
