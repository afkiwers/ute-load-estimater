import { useEffect, useMemo } from 'react';
import { RoundedBox } from '@react-three/drei';
import * as THREE from 'three';
import type { CaravanSpec, HitchSpec } from '../model/types';
import { caravanGeometry, toWorld } from '../model/geometry';
import { rimDiameter } from '../model/tyres';
import { boxWorld } from './parts';
import { RBox, Wheel, useMaterials } from './kit';

interface Props {
  caravan: CaravanSpec;
  hitch: HitchSpec;
  offset: number;
  xray: boolean;
}

/** A-frame, chassis, rounded see-through body and axle group, scaled to the entered dimensions. */
export function CaravanModel({ caravan: cv, hitch, offset, xray }: Props) {
  const c = useMemo(() => caravanGeometry(cv, hitch), [cv, hitch]);
  const m = useMaterials('#f3f3f1', xray);
  const shellMat = useMemo(
    () =>
      new THREE.MeshPhysicalMaterial({
        color: '#ffffff',
        roughness: 0.25,
        clearcoat: 0.6,
        transparent: true,
        opacity: xray ? 0.06 : 0.3,
        depthWrite: false,
      }),
    [xray],
  );
  const stripeMat = useMemo(() => new THREE.MeshStandardMaterial({ color: '#3a4048', roughness: 0.4, metalness: 0.3 }), []);
  const accentMat = useMemo(() => new THREE.MeshStandardMaterial({ color: '#d9590f', roughness: 0.4 }), []);
  useEffect(() => () => [shellMat, stripeMat, accentMat].forEach((mat) => mat.dispose()), [shellMat, stripeMat, accentMat]);

  const half = cv.bodyWidth / 2;
  const L = cv.bodyLength;
  const railY = Math.min(half - 150, cv.track / 2 - 250);
  const railZ = c.drawbarZ;
  const fz = c.floorZ;
  const v = { host: 'caravan' as const, offset };
  const shellBox = boxWorld('caravan', { x0: c.bodyStart, x1: c.bodyEnd, y0: -half, y1: half, z0: fz, z1: c.roofZ }, offset);
  const yy = (side: number, a: number, b: number) => ({ y0: Math.min(side * a, side * b), y1: Math.max(side * a, side * b) });

  // A-frame rails run from the coupling out to the chassis rails at the body front.
  const aFrame = [-1, 1].map((side) => {
    const [x0, , z0] = toWorld('caravan', { x: 150, y: 0, z: railZ }, offset);
    const [x1, , z1] = toWorld('caravan', { x: c.bodyStart, y: side * railY, z: railZ }, offset);
    const dx = x1 - x0;
    const dz = z1 - z0;
    return {
      side,
      position: [(x0 + x1) / 2, railZ / 1000, (z0 + z1) / 2] as [number, number, number],
      length: Math.hypot(dx, dz),
      rotY: Math.atan2(-dz, dx),
    };
  });

  return (
    <group>
      {/* Coupling, A-frame, drawbar plate and jockey wheel */}
      <RBox {...v} b={{ x0: -40, x1: 260, y0: -60, y1: 60, z0: c.couplingZ - 10, z1: c.couplingZ + 70 }} r={20} material={m.brushed} />
      {aFrame.map((a) => (
        <mesh key={a.side} position={a.position} rotation={[0, a.rotY, 0]} castShadow material={m.chassis}>
          <boxGeometry args={[a.length, 0.1, 0.05]} />
        </mesh>
      ))}
      <RBox
        {...v}
        b={{ x0: c.drawbarStart, x1: c.bodyStart - 20, y0: -0.3 * cv.bodyWidth, y1: 0.3 * cv.bodyWidth, z0: c.drawbarZ - 14, z1: c.drawbarZ }}
        r={6}
        material={m.brushed}
        surface="cvDrawbar"
      />
      <mesh position={toWorld('caravan', { x: 520, y: 0, z: (c.drawbarZ + 120) / 2 }, offset)} material={m.chassis}>
        <cylinderGeometry args={[0.03, 0.03, (c.drawbarZ - 120) / 1000, 12]} />
      </mesh>
      <mesh position={toWorld('caravan', { x: 520, y: 0, z: 80 }, offset)} rotation={[Math.PI / 2, 0, 0]} material={m.plastic}>
        <cylinderGeometry args={[0.08, 0.08, 0.06, 20]} />
      </mesh>

      {/* WDH spring bars */}
      {hitch.wdh.enabled &&
        [-1, 1].map((side) => (
          <RBox key={side} {...v} b={{ x0: 120, x1: 1000, y0: side * 120 - 15, y1: side * 120 + 15, z0: c.couplingZ - 70, z1: c.couplingZ - 40 }} r={10} material={accentMat} />
        ))}

      {/* Chassis rails and floor (drop target) */}
      {[-1, 1].map((side) => (
        <RBox key={side} {...v} b={{ x0: c.bodyStart, x1: c.bodyEnd, y0: side * railY - 25, y1: side * railY + 25, z0: railZ - 50, z1: railZ + 50 }} r={6} material={m.chassis} />
      ))}
      <RBox {...v} b={{ x0: c.bodyStart + 20, x1: c.bodyEnd - 20, y0: -half + 20, y1: half - 20, z0: fz - 40, z1: fz }} r={10} material={floorMat} surface="cvFloor" />

      {/* Body: rounded see-through shell so the load stays visible; solid roof unless x-ray */}
      <RoundedBox args={shellBox.args} radius={0.14} smoothness={4} position={shellBox.position} material={shellMat} />
      {!xray && (
        <>
          <RBox {...v} b={{ x0: c.bodyStart + 30, x1: c.bodyEnd - 30, y0: -half + 30, y1: half - 30, z0: c.roofZ - 60, z1: c.roofZ - 2 }} r={40} material={roofMat} surface="cvRoof" />
          {/* Windows, entry door on the kerb (left) side, stripes */}
          {[-1, 1].map((side) => (
            <group key={side}>
              {[0.16, 0.55, 0.85].map((f) => (
                <RBox key={f} {...v} b={{ x0: c.bodyStart + f * L - 420, x1: c.bodyStart + f * L + 420, ...yy(side, half - 6, half + 8), z0: fz + 980, z1: fz + 1560 }} r={70} material={m.glass} shadow={false} />
              ))}
              <RBox {...v} b={{ x0: c.bodyStart + 60, x1: c.bodyEnd - 60, ...yy(side, half - 4, half + 6), z0: fz + 70, z1: fz + 300 }} r={20} material={stripeMat} />
              <RBox {...v} b={{ x0: c.bodyStart + 60, x1: c.bodyEnd - 60, ...yy(side, half - 4, half + 7), z0: fz + 322, z1: fz + 344 }} r={8} material={accentMat} />
            </group>
          ))}
          {(() => {
            const dx = c.bodyStart + 0.34 * L;
            const strip = (b: { x0: number; x1: number; z0: number; z1: number }, k: string) => (
              <RBox key={k} {...v} b={{ ...b, ...yy(-1, half - 4, half + 10) }} r={8} material={m.gloss} shadow={false} />
            );
            return (
              <>
                {strip({ x0: dx - 330, x1: dx - 300, z0: fz + 60, z1: fz + 1880 }, 'l')}
                {strip({ x0: dx + 300, x1: dx + 330, z0: fz + 60, z1: fz + 1880 }, 'r')}
                {strip({ x0: dx - 330, x1: dx + 330, z0: fz + 1850, z1: fz + 1880 }, 't')}
                <RBox {...v} b={{ x0: dx - 200, x1: dx + 200, ...yy(-1, half - 4, half + 9), z0: fz + 1250, z1: fz + 1700 }} r={50} material={m.glass} shadow={false} />
                <RBox {...v} b={{ x0: dx + 210, x1: dx + 260, ...yy(-1, half - 4, half + 24), z0: fz + 950, z1: fz + 1000 }} r={8} material={m.chrome} />
              </>
            );
          })()}
          {/* Front: window and stone guard. Rear: window and tail lights. */}
          <RBox {...v} b={{ x0: c.bodyStart - 8, x1: c.bodyStart + 6, y0: -half * 0.6, y1: half * 0.6, z0: fz + 950, z1: fz + 1500 }} r={60} material={m.glass} shadow={false} />
          <RBox {...v} b={{ x0: c.bodyStart - 14, x1: c.bodyStart + 4, y0: -half + 90, y1: half - 90, z0: fz + 30, z1: fz + 560 }} r={20} material={m.brushed} />
          <RBox {...v} b={{ x0: c.bodyEnd - 6, x1: c.bodyEnd + 8, y0: -half * 0.45, y1: half * 0.45, z0: fz + 1050, z1: fz + 1450 }} r={50} material={m.glass} shadow={false} />
          {[-1, 1].map((side) => (
            <RBox key={side} {...v} b={{ x0: c.bodyEnd - 4, x1: c.bodyEnd + 12, ...yy(side, half - 260, half - 80), z0: fz + 150, z1: fz + 270 }} r={12} material={m.red} />
          ))}
        </>
      )}

      {/* Rear bumper (drop target for bike racks, spare wheel) */}
      <RBox {...v} b={{ x0: c.bodyEnd, x1: c.bodyEnd + 150, y0: -half + 100, y1: half - 100, z0: fz - 260, z1: fz - 120 }} r={12} material={m.chassis} surface="cvBumper" />

      {/* Running gear */}
      {c.axles.map((x) =>
        [-1, 1].map((side) => (
          <Wheel
            key={`${x}${side}`}
            host="caravan"
            offset={offset}
            x={x}
            y={(side * cv.track) / 2}
            r={c.wheelR}
            rimR={((rimDiameter(cv.tyre.size) ?? 15) * 25.4) / 2}
            width={c.tyreW}
            style="highway"
          />
        )),
      )}
    </group>
  );
}

const floorMat = new THREE.MeshStandardMaterial({ color: '#b9a27f', roughness: 0.85 });
const roofMat = new THREE.MeshPhysicalMaterial({ color: '#f6f6f4', roughness: 0.3, clearcoat: 0.5 });
