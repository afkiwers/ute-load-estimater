import { useEffect, useMemo } from 'react';
import { RoundedBox } from '@react-three/drei';
import * as THREE from 'three';
import type { CaravanSpec, HitchSpec } from '../model/types';
import { caravanGeometry, toWorld, type CaravanGeometry } from '../model/geometry';
import { rimDiameter } from '../model/tyres';
import { boxWorld, surfaceData } from './parts';
import { RBox, Strut, Wheel, useMaterials, type Materials } from './kit';

interface Props {
  caravan: CaravanSpec;
  hitch: HitchSpec;
  offset: number;
  xray: boolean;
}

interface BodyProps {
  cv: CaravanSpec;
  c: CaravanGeometry;
  m: Materials;
  offset: number;
  xray: boolean;
  accent: THREE.Material;
}

const yy = (side: number, a: number, b: number) => ({ y0: Math.min(side * a, side * b), y1: Math.max(side * a, side * b) });

/** A solid body shell like the ute's; x-ray turns it into a faint ghost so the load inside can be seen and placed. */
function useShellMaterial(xray: boolean, params: THREE.MeshPhysicalMaterialParameters) {
  const mat = useMemo(
    () => new THREE.MeshPhysicalMaterial({ ...params, ...(xray ? { transparent: true, opacity: 0.12, depthWrite: false } : {}) }),
    [xray],
  );
  useEffect(() => () => mat.dispose(), [mat]);
  return mat;
}

/** Outside of a closed body: a drop target unless in x-ray, when drops go through it to the floor inside. */
const shellProps = (xray: boolean) => ({ castShadow: !xray, receiveShadow: !xray, userData: surfaceData(xray ? null : 'cvBody', 'caravan') });

/** Checker plate between the A-frame rails, tapering with them towards the coupling. */
function DrawbarPlate({ c, m, offset, railY }: { c: CaravanGeometry; m: Materials; offset: number; railY: number }) {
  const geo = useMemo(() => {
    const halfAt = (x: number) => (railY * (x - 150)) / (c.bodyStart - 150) - 30;
    const x0 = c.drawbarStart;
    const x1 = c.bodyStart - 20;
    // Shape in the world X/Z plane; rotated so it extrudes downward from the top of the plate.
    const pt = (x: number, y: number) => new THREE.Vector2(toWorld('caravan', { x, y, z: 0 }, offset)[0], y / 1000);
    const shape = new THREE.Shape([pt(x0, -halfAt(x0)), pt(x1, -halfAt(x1)), pt(x1, halfAt(x1)), pt(x0, halfAt(x0))]);
    const g = new THREE.ExtrudeGeometry(shape, { depth: 0.014, bevelEnabled: false });
    g.rotateX(Math.PI / 2);
    return g;
  }, [c, offset, railY]);
  useEffect(() => () => geo.dispose(), [geo]);
  return (
    <mesh geometry={geo} position={[0, c.drawbarZ / 1000, 0]} material={m.brushed} castShadow receiveShadow userData={surfaceData('cvDrawbar', 'caravan')} />
  );
}

/**
 * Drawbar, running gear and (for small trailers) mudguards, shared by every trailer type. No jockey wheel: hitched, it is wound up
 * and carries nothing, and drawn on the ground it looked as if it took some of the ball weight.
 */
function Chassis({ cv, c, m, offset, accent, hitch }: BodyProps & { hitch: HitchSpec }) {
  const v = { host: 'caravan' as const, offset };
  const half = cv.bodyWidth / 2;
  const central = cv.kind === 'boat';
  const railY = central ? 0.22 * cv.bodyWidth : Math.min(half - 150, cv.track / 2 - 250);
  const railZ = c.drawbarZ;
  const rimR = ((rimDiameter(cv.tyre.size) ?? 15) * 25.4) / 2;
  // Wheels outside the body need guards; a caravan's sit under its floor.
  const guards = cv.track / 2 + c.tyreW / 2 > half - 40;

  // A-frame rails run from the coupling out to the chassis rails at the body front.
  const aFrame = (central ? [0] : [-1, 1]).map((side) => {
    const reach = central ? c.bodyStart + 900 : c.bodyStart;
    const [x0, , z0] = toWorld('caravan', { x: 150, y: 0, z: railZ }, offset);
    const [x1, , z1] = toWorld('caravan', { x: reach, y: side * railY, z: railZ }, offset);
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
      <RBox {...v} b={{ x0: -40, x1: 260, y0: -60, y1: 60, z0: c.couplingZ - 10, z1: c.couplingZ + 70 }} r={20} material={m.brushed} />
      {aFrame.map((a) => (
        <mesh key={a.side} position={a.position} rotation={[0, a.rotY, 0]} castShadow material={m.chassis}>
          <boxGeometry args={[a.length, 0.1, central ? 0.1 : 0.05]} />
        </mesh>
      ))}
      {!central && <DrawbarPlate c={c} m={m} offset={offset} railY={railY} />}

      {hitch.wdh.enabled &&
        [-1, 1].map((side) => (
          <RBox key={side} {...v} b={{ x0: 120, x1: 1000, y0: side * 120 - 15, y1: side * 120 + 15, z0: c.couplingZ - 70, z1: c.couplingZ - 40 }} r={10} material={accent} />
        ))}

      {[-1, 1].map((side) => (
        <RBox
          key={side}
          {...v}
          b={{ x0: central ? c.bodyStart + 600 : c.bodyStart, x1: c.bodyEnd, y0: side * railY - 25, y1: side * railY + 25, z0: railZ - 50, z1: railZ + 50 }}
          r={6}
          material={m.chassis}
        />
      ))}
      {c.axles.map((x) => (
        <Strut key={x} host="caravan" offset={offset} a={{ x, y: -cv.track / 2 + 60, z: c.wheelR }} b={{ x, y: cv.track / 2 - 60, z: c.wheelR }} w={60} d={60} material={m.chassis} />
      ))}
      {c.axles.map((x) =>
        [-1, 1].map((side) => (
          <group key={`${x}${side}`}>
            <Wheel host="caravan" offset={offset} x={x} y={(side * cv.track) / 2} r={c.wheelR} rimR={rimR} width={c.tyreW} style="highway" />
            {guards && (
              <mesh position={toWorld('caravan', { x, y: (side * cv.track) / 2, z: c.wheelR }, offset)} rotation={[Math.PI / 2, 0, 0]} material={m.brushed} castShadow>
                <cylinderGeometry args={[(c.wheelR + 70) / 1000, (c.wheelR + 70) / 1000, (c.tyreW + 90) / 1000, 32, 1, true, Math.PI / 2, Math.PI]} />
              </mesh>
            )}
          </group>
        )),
      )}
    </group>
  );
}

function CaravanBody({ cv, c, m, offset, xray, accent }: BodyProps) {
  const shellMat = useShellMaterial(xray, { color: '#f2f3f1', metalness: 0.05, roughness: 0.35, clearcoat: 0.6, clearcoatRoughness: 0.2 });
  const v = { host: 'caravan' as const, offset };
  const half = cv.bodyWidth / 2;
  const L = cv.bodyLength;
  const fz = c.floorZ;
  const shellBox = boxWorld('caravan', { x0: c.bodyStart, x1: c.bodyEnd, y0: -half, y1: half, z0: fz - 60, z1: c.roofZ }, offset);
  const dx = c.bodyStart + 0.34 * L;
  const strip = (b: { x0: number; x1: number; z0: number; z1: number }, k: string) => (
    <RBox key={k} {...v} b={{ ...b, ...yy(-1, half - 4, half + 10) }} r={8} material={m.gloss} shadow={false} />
  );
  return (
    <group>
      {/* Inset so its edge stays inside the shell's rounded bottom */}
      <RBox {...v} b={{ x0: c.bodyStart + 80, x1: c.bodyEnd - 80, y0: -half + 80, y1: half - 80, z0: fz - 40, z1: fz }} r={10} material={floorMat} surface="cvFloor" />
      <RoundedBox args={shellBox.args} radius={0.14} smoothness={4} position={shellBox.position} material={shellMat} {...shellProps(xray)} />
      {!xray && (
        <>
          {/* Tinted windows, entry door on the kerb (left) side, stripes */}
          {[-1, 1].map((side) => (
            <group key={side}>
              {[0.16, 0.55, 0.85].map((f) => (
                <RBox key={f} {...v} b={{ x0: c.bodyStart + f * L - 420, x1: c.bodyStart + f * L + 420, ...yy(side, half - 6, half + 8), z0: fz + 980, z1: fz + 1560 }} r={70} material={m.gloss} shadow={false} />
              ))}
              <RBox {...v} b={{ x0: c.bodyStart + 60, x1: c.bodyEnd - 60, ...yy(side, half - 4, half + 6), z0: fz + 70, z1: fz + 300 }} r={20} material={stripeMat} />
              <RBox {...v} b={{ x0: c.bodyStart + 60, x1: c.bodyEnd - 60, ...yy(side, half - 4, half + 7), z0: fz + 322, z1: fz + 344 }} r={8} material={accent} />
            </group>
          ))}
          {strip({ x0: dx - 330, x1: dx - 300, z0: fz + 60, z1: fz + 1880 }, 'l')}
          {strip({ x0: dx + 300, x1: dx + 330, z0: fz + 60, z1: fz + 1880 }, 'r')}
          {strip({ x0: dx - 330, x1: dx + 330, z0: fz + 1850, z1: fz + 1880 }, 't')}
          <RBox {...v} b={{ x0: dx - 200, x1: dx + 200, ...yy(-1, half - 4, half + 9), z0: fz + 1250, z1: fz + 1700 }} r={50} material={m.gloss} shadow={false} />
          <RBox {...v} b={{ x0: dx + 210, x1: dx + 260, ...yy(-1, half - 4, half + 24), z0: fz + 950, z1: fz + 1000 }} r={8} material={m.chrome} />
          {/* Front: window and stone guard. Rear: window and tail lights. */}
          <RBox {...v} b={{ x0: c.bodyStart - 8, x1: c.bodyStart + 6, y0: -half * 0.6, y1: half * 0.6, z0: fz + 950, z1: fz + 1500 }} r={60} material={m.gloss} shadow={false} />
          <RBox {...v} b={{ x0: c.bodyStart - 14, x1: c.bodyStart + 4, y0: -half + 90, y1: half - 90, z0: fz + 30, z1: fz + 560 }} r={20} material={m.brushed} />
          <RBox {...v} b={{ x0: c.bodyEnd - 6, x1: c.bodyEnd + 8, y0: -half * 0.45, y1: half * 0.45, z0: fz + 1050, z1: fz + 1450 }} r={50} material={m.gloss} shadow={false} />
          {[-1, 1].map((side) => (
            <RBox key={side} {...v} b={{ x0: c.bodyEnd - 4, x1: c.bodyEnd + 12, ...yy(side, half - 260, half - 80), z0: fz + 150, z1: fz + 270 }} r={12} material={m.red} />
          ))}
        </>
      )}
      {/* Rear bumper (drop target for bike racks, spare wheel) */}
      <RBox {...v} b={{ x0: c.bodyEnd, x1: c.bodyEnd + 150, y0: -half + 100, y1: half - 100, z0: fz - 260, z1: fz - 120 }} r={12} material={m.chassis} surface="cvBumper" />
    </group>
  );
}

function TailLights({ c, m, offset, half, z }: { c: CaravanGeometry; m: Materials; offset: number; half: number; z: number }) {
  return (
    <>
      {[-1, 1].map((side) => (
        <RBox key={side} host="caravan" offset={offset} b={{ x0: c.bodyEnd - 2, x1: c.bodyEnd + 30, ...yy(side, half - 220, half - 40), z0: z, z1: z + 90 }} r={12} material={m.red} />
      ))}
      <RBox host="caravan" offset={offset} b={{ x0: c.bodyEnd - 2, x1: c.bodyEnd + 24, y0: -240, y1: 240, z0: z - 10, z1: z + 100 }} r={8} material={m.plastic} />
    </>
  );
}

function EnclosedBody({ cv, c, m, offset, xray }: BodyProps) {
  const shellMat = useShellMaterial(xray, { color: '#3a4048', metalness: 0.3, roughness: 0.35, clearcoat: 0.4 });
  const v = { host: 'caravan' as const, offset };
  const half = cv.bodyWidth / 2;
  const fz = c.floorZ;
  const shellBox = boxWorld('caravan', { x0: c.bodyStart, x1: c.bodyEnd, y0: -half, y1: half, z0: fz, z1: c.roofZ }, offset);
  return (
    <group>
      <RBox {...v} b={{ x0: c.bodyStart, x1: c.bodyEnd, y0: -half, y1: half, z0: fz - 50, z1: fz }} r={8} material={floorMat} surface="cvFloor" />
      <RoundedBox args={shellBox.args} radius={0.04} smoothness={3} position={shellBox.position} material={shellMat} {...shellProps(xray)} />
      {!xray && (
        <>
          <RBox {...v} b={{ x0: c.bodyStart, x1: c.bodyEnd, y0: -half, y1: half, z0: c.roofZ - 40, z1: c.roofZ + 10 }} r={20} material={m.brushed} surface="cvRoof" />
          {/* Corner posts, rear barn doors */}
          {[c.bodyStart, c.bodyEnd].map((x) =>
            [-1, 1].map((side) => (
              <RBox key={`${x}${side}`} {...v} b={{ x0: x - 30, x1: x + 30, ...yy(side, half - 30, half + 6), z0: fz, z1: c.roofZ }} r={8} material={m.brushed} />
            )),
          )}
          <RBox {...v} b={{ x0: c.bodyEnd, x1: c.bodyEnd + 12, y0: -8, y1: 8, z0: fz + 40, z1: c.roofZ - 40 }} r={3} material={m.gloss} />
          {[-1, 1].map((side) => (
            <RBox key={side} {...v} b={{ x0: c.bodyEnd + 4, x1: c.bodyEnd + 30, ...yy(side, 60, 90), z0: fz + 700, z1: fz + 1100 }} r={6} material={m.chrome} />
          ))}
        </>
      )}
      <TailLights c={c} m={m} offset={offset} half={half} z={fz - 160} />
    </group>
  );
}

function OpenBody({ cv, c, m, offset, xray }: BodyProps) {
  const v = { host: 'caravan' as const, offset };
  const half = cv.bodyWidth / 2;
  const fz = c.floorZ;
  const top = fz + cv.bodyHeight;
  const wall = 35;
  const wallSurface = xray ? null : 'cvWall';
  return (
    <group>
      <RBox {...v} b={{ x0: c.bodyStart, x1: c.bodyEnd, y0: -half, y1: half, z0: fz - 40, z1: fz }} r={6} material={deckMat} surface="cvFloor" />
      {[-1, 1].map((side) => (
        <RBox key={side} {...v} b={{ x0: c.bodyStart, x1: c.bodyEnd, ...yy(side, half - wall, half), z0: fz, z1: top }} r={8} material={m.brushed} surface={wallSurface} />
      ))}
      <RBox {...v} b={{ x0: c.bodyStart, x1: c.bodyStart + wall, y0: -half, y1: half, z0: fz, z1: top }} r={8} material={m.brushed} surface={wallSurface} />
      <RBox {...v} b={{ x0: c.bodyEnd - wall, x1: c.bodyEnd, y0: -half + wall, y1: half - wall, z0: fz, z1: top - 10 }} r={8} material={m.brushed} surface={wallSurface} />
      {/* Pressed ribs on the sides and the top rail */}
      {[-1, 1].map((side) => (
        <group key={side}>
          {[0.33, 0.66].map((f) => (
            <RBox key={f} {...v} b={{ x0: c.bodyStart + 20, x1: c.bodyEnd - 20, ...yy(side, half - 4, half + 8), z0: fz + f * cv.bodyHeight - 12, z1: fz + f * cv.bodyHeight + 12 }} r={6} material={m.brushed} />
          ))}
          <RBox {...v} b={{ x0: c.bodyStart, x1: c.bodyEnd, ...yy(side, half - 45, half + 10), z0: top - 4, z1: top + 30 }} r={10} material={m.brushed} />
        </group>
      ))}
      <TailLights c={c} m={m} offset={offset} half={half} z={fz - 150} />
    </group>
  );
}

function BoatTrailerBody({ cv, c, m, offset }: BodyProps) {
  const v = { host: 'caravan' as const, offset };
  const bunkY = 0.28 * cv.bodyWidth;
  const fz = c.floorZ;
  const railZ = c.drawbarZ;
  const lightHalf = cv.track / 2 + c.tyreW / 2 + 40;
  return (
    <group>
      {/* Carpeted bunks (drop target) on posts, crossmembers */}
      {[-1, 1].map((side) => (
        <group key={side}>
          <RBox {...v} b={{ x0: c.bodyStart + 600, x1: c.bodyEnd - 100, ...yy(side, bunkY - 60, bunkY + 60), z0: fz - 50, z1: fz }} r={14} material={bunkMat} surface="cvFloor" />
          {[c.bodyStart + 1200, (c.bodyStart + c.bodyEnd) / 2 + 300, c.bodyEnd - 400].map((x) => (
            <Strut key={x} host="caravan" offset={offset} a={{ x, y: side * 0.22 * cv.bodyWidth, z: railZ }} b={{ x, y: side * bunkY, z: fz - 50 }} w={40} d={40} material={m.chassis} />
          ))}
        </group>
      ))}
      {[c.bodyStart + 1200, (c.bodyStart + c.bodyEnd) / 2 + 300, c.bodyEnd - 400].map((x) => (
        <RBox key={x} {...v} b={{ x0: x - 30, x1: x + 30, y0: -0.25 * cv.bodyWidth, y1: 0.25 * cv.bodyWidth, z0: railZ - 40, z1: railZ + 40 }} r={6} material={m.chassis} />
      ))}
      {/* Winch post with winch and bow stop */}
      <RBox {...v} b={{ x0: c.bodyStart - 40, x1: c.bodyStart + 40, y0: -40, y1: 40, z0: railZ, z1: fz + 480 }} r={8} material={m.chassis} />
      <RBox {...v} b={{ x0: c.bodyStart - 160, x1: c.bodyStart - 40, y0: -90, y1: 90, z0: fz + 220, z1: fz + 360 }} r={20} material={m.gloss} />
      <RBox {...v} b={{ x0: c.bodyStart + 40, x1: c.bodyStart + 120, y0: -70, y1: 70, z0: fz + 380, z1: fz + 470 }} r={30} material={m.plastic} />
      {/* Rear light bar with plate */}
      <RBox {...v} b={{ x0: c.bodyEnd + 20, x1: c.bodyEnd + 70, y0: -lightHalf, y1: lightHalf, z0: railZ + 40, z1: railZ + 90 }} r={8} material={m.chassis} />
      {[-1, 1].map((side) => (
        <RBox key={side} {...v} b={{ x0: c.bodyEnd + 70, x1: c.bodyEnd + 110, ...yy(side, lightHalf - 180, lightHalf), z0: railZ + 30, z1: railZ + 120 }} r={12} material={m.red} />
      ))}
      <RBox {...v} b={{ x0: c.bodyEnd + 70, x1: c.bodyEnd + 90, y0: -240, y1: 240, z0: railZ + 100, z1: railZ + 210 }} r={6} material={m.plastic} />
    </group>
  );
}

/** The towed trailer, drawn for its type and scaled to the entered dimensions. */
export function TrailerModel({ caravan: cv, hitch, offset, xray }: Props) {
  const c = useMemo(() => caravanGeometry(cv, hitch), [cv, hitch]);
  const m = useMaterials('#f3f3f1', xray);
  const props: BodyProps = { cv, c, m, offset, xray, accent: accentMat };
  return (
    <group>
      <Chassis {...props} hitch={hitch} />
      {cv.kind === 'caravan' && <CaravanBody {...props} />}
      {cv.kind === 'enclosed' && <EnclosedBody {...props} />}
      {cv.kind === 'open' && <OpenBody {...props} />}
      {cv.kind === 'boat' && <BoatTrailerBody {...props} />}
    </group>
  );
}

const floorMat = new THREE.MeshStandardMaterial({ color: '#b9a27f', roughness: 0.85 });
const deckMat = new THREE.MeshStandardMaterial({ color: '#8f969d', metalness: 0.6, roughness: 0.45 });
const bunkMat = new THREE.MeshStandardMaterial({ color: '#4a3f36', roughness: 0.95 });
const stripeMat = new THREE.MeshStandardMaterial({ color: '#3a4048', roughness: 0.4, metalness: 0.3 });
const accentMat = new THREE.MeshStandardMaterial({ color: '#d9590f', roughness: 0.4 });
