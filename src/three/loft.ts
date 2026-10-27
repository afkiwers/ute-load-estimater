// Lofted surfaces: cross-sections at stations along the vehicle, joined into
// one smooth skin. Each station lists its outline as zones; points within a
// zone are shaded smoothly, a new zone starts a crease.

import * as THREE from 'three';
import { toWorld } from '../model/geometry';

/** A point in a cross-section: lateral offset y and height z (mm, ute frame). */
export type Pt = [number, number];

export interface Station {
  /** Distance behind the front axle (mm). */
  x: number;
  /** Same number of zones, and points per zone, at every station of a loft. */
  zones: Pt[][];
}

export interface LoftOptions {
  /** Close the first or last station with a flat cap (single-zone outlines only). */
  capStart?: boolean;
  capEnd?: boolean;
  /** Material index for the quad from point i to i+1 of zone k, between stations j and j+1. */
  group?: (j: number, k: number, i: number) => number;
}

export function loft(stations: Station[], opts: LoftOptions = {}): THREE.BufferGeometry {
  const pos: number[] = [];
  const byGroup: number[][] = [];
  const push = (g: number, ...idx: number[]) => (byGroup[g] ??= []).push(...idx);
  const start: number[][] = [];
  for (const st of stations) {
    const row: number[] = [];
    for (const zone of st.zones) {
      row.push(pos.length / 3);
      for (const [y, z] of zone) pos.push(...toWorld('ute', { x: st.x, y, z }, 0));
    }
    start.push(row);
  }

  // Outlines run up the right side, over the top and down the left while
  // stations run rearward, so (a, b, c) winds outward.
  for (let j = 0; j < stations.length - 1; j++) {
    stations[j].zones.forEach((zone, k) => {
      for (let i = 0; i < zone.length - 1; i++) {
        const a = start[j][k] + i;
        const b = a + 1;
        const d = start[j + 1][k] + i;
        const c = d + 1;
        push(opts.group?.(j, k, i) ?? 0, a, b, c, a, c, d);
      }
    });
  }

  // Flat caps get their own vertices so they shade flat.
  const cap = (st: Station, front: boolean) => {
    const ring = st.zones[0];
    const centre = ring.reduce<Pt>((acc, [y, z]) => [acc[0] + y / ring.length, acc[1] + z / ring.length], [0, 0]);
    const c0 = pos.length / 3;
    pos.push(...toWorld('ute', { x: st.x, y: centre[0], z: centre[1] }, 0));
    for (const [y, z] of ring) pos.push(...toWorld('ute', { x: st.x, y, z }, 0));
    for (let i = 0; i < ring.length - 1; i++) {
      if (front) push(0, c0, c0 + 2 + i, c0 + 1 + i);
      else push(0, c0, c0 + 1 + i, c0 + 2 + i);
    }
  };
  if (opts.capStart) cap(stations[0], true);
  if (opts.capEnd) cap(stations[stations.length - 1], false);

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  const index: number[] = [];
  byGroup.forEach((idx, g) => {
    if (!idx?.length) return;
    geo.addGroup(index.length, idx.length, g);
    index.push(...idx);
  });
  geo.setIndex(index);
  geo.computeVertexNormals();
  return geo;
}

/** Station positions from a to b: a coarse step plus finer steps inside the given ranges. */
export function stationsBetween(a: number, b: number, coarse: number, fine: [number, number, number][]): number[] {
  const xs = [a, b];
  for (let x = a; x < b; x += coarse) xs.push(x);
  for (const [from, to, step] of fine) {
    for (let x = Math.max(a, from); x <= Math.min(b, to); x += step) xs.push(x);
  }
  xs.sort((p, q) => p - q);
  return xs.filter((x, i) => i === 0 || x - xs[i - 1] > 2);
}
