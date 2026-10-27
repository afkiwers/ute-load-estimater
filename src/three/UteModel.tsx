import { useEffect, useMemo } from 'react';
import * as THREE from 'three';
import type { HitchSpec, UteSpec } from '../model/types';
import { toWorld, uteGeometry } from '../model/geometry';
import { surfaceData, useArchFlare } from './parts';
import { RBox, Strut, Wheel, useMaterials, useRingRect, type Materials } from './kit';
import { makeUteShape, type UteShape } from './uteBody';

interface Props {
  ute: UteSpec;
  hitch: HitchSpec;
  xray: boolean;
}

type G = ReturnType<typeof uteGeometry>;

/** Invisible but clickable: lets items be dropped on the roof without hiding the cab behind a box. */
const pickOnly = new THREE.MeshBasicMaterial({ colorWrite: false, depthWrite: false });

interface FrontPieceProps {
  shape: UteShape;
  /** Lateral extent (either order) and height (mm). */
  y0: number;
  y1: number;
  z0: number;
  z1: number;
  depth: number;
  /** How far the piece stands proud of the front surface. */
  proud?: number;
  r?: number;
  material: THREE.Material;
  surface?: string | null;
  shadow?: boolean;
}

/** A part on the rounded nose, turned to follow the front corner it sits on. */
function FrontPiece({ shape, y0, y1, z0, z1, depth, proud = 0, r = 10, material, surface = null, shadow = true }: FrontPieceProps) {
  const lo = Math.min(y0, y1);
  const hi = Math.max(y0, y1);
  const zc = (z0 + z1) / 2;
  const xa = shape.frontX(lo, zc);
  const xb = shape.frontX(hi, zc);
  const len = Math.hypot(hi - lo, xb - xa);
  const yc = (lo + hi) / 2;
  // The nose is convex, so a flat part along the chord would sink in the middle: bring it forward by the sag.
  const sag = Math.max(0, (xa + xb) / 2 - shape.frontX(yc, zc));
  const face = (xa + xb) / 2 - sag - proud;
  return (
    <RBox
      b={{ x0: face, x1: face + depth, y0: yc - len / 2, y1: yc + len / 2, z0, z1 }}
      r={r}
      material={material}
      rotation={[0, Math.atan2(-(xb - xa), hi - lo), 0]}
      surface={surface}
      shadow={shadow}
    />
  );
}

function Interior({ g, m }: { g: G; m: Materials }) {
  const half = g.bodyW / 2;
  const [driver, passenger, rearR, rearL] = g.seats;
  const seat = (s: { x: number; y: number; z: number }, w: number, key: string) => (
    <group key={key}>
      <RBox b={{ x0: s.x - 270, x1: s.x + 200, y0: s.y - w / 2, y1: s.y + w / 2, z0: s.z - 330, z1: s.z - 210 }} r={40} material={m.interior} surface="seat" />
      <RBox
        b={{ x0: s.x + 150, x1: s.x + 270, y0: s.y - w / 2, y1: s.y + w / 2, z0: s.z - 220, z1: s.z + 420 }}
        r={45}
        material={m.interior}
        surface="seat"
      />
      <RBox b={{ x0: s.x + 170, x1: s.x + 260, y0: s.y - 120, y1: s.y + 120, z0: s.z + 440, z1: s.z + 600 }} r={35} material={m.interior} />
    </group>
  );
  const wheelPos = { x: g.sWindscreen + 560, y: driver.y, z: g.zBelt - 10 };
  return (
    <group>
      {seat(driver, 480, 'd')}
      {seat(passenger, 480, 'p')}
      <RBox b={{ x0: rearR.x - 270, x1: rearR.x + 200, y0: rearL.y - 260, y1: rearR.y + 260, z0: rearR.z - 330, z1: rearR.z - 210 }} r={40} material={m.interior} surface="seat" />
      <RBox b={{ x0: rearR.x + 150, x1: rearR.x + 270, y0: rearL.y - 260, y1: rearR.y + 260, z0: rearR.z - 220, z1: rearR.z + 400 }} r={45} material={m.interior} surface="seat" />
      <RBox b={{ x0: g.sWindscreen + 40, x1: g.sWindscreen + 430, y0: -half + 110, y1: half - 110, z0: g.zBelt - 240, z1: g.zBelt + 40 }} r={60} material={m.interior} />
      <RBox b={{ x0: driver.x - 250, x1: g.sWindscreen + 450, y0: -110, y1: 110, z0: driver.z - 330, z1: driver.z - 120 }} r={40} material={m.interior} />
      <mesh position={toWorld('ute', wheelPos, 0)} rotation={[0, Math.PI / 2, -0.45]}>
        <torusGeometry args={[0.18, 0.022, 12, 36]} />
        <meshStandardMaterial color="#121315" roughness={0.6} />
      </mesh>
    </group>
  );
}

function FrontEnd({ g, m, shape, xray }: { g: G; m: Materials; shape: UteShape; xray: boolean }) {
  const W = g.bodyW;
  const sF = g.sFront;
  const zb = g.bumperBottom;
  const front = xray ? null : 'front';
  const gw = 0.62 * W;
  const gz0 = zb + 250;
  const gz1 = g.zBonnetFront - 60;
  const gh = gz1 - gz0;
  const gz = (gz0 + gz1) / 2;
  const ring = useRingRect(gw, gh, 58, 110, 46);
  const badgeZ = gz + gh * 0.16;
  const fp = { shape };
  return (
    <group>
      {/* Chrome-framed grille with horizontal bars and the pin badge */}
      <mesh geometry={ring} material={m.chrome} position={toWorld('ute', { x: sF - 20, y: 0, z: gz }, 0)} rotation={[0, Math.PI / 2, 0]} castShadow userData={surfaceData(front, 'ute')} />
      <RBox b={{ x0: sF - 8, x1: sF + 30, y0: -gw / 2 + 40, y1: gw / 2 - 40, z0: gz0 + 40, z1: gz1 - 40 }} r={30} material={m.housing} surface={front} />
      {[0.3, 0.12].map((f) => (
        <RBox key={f} b={{ x0: sF - 22, x1: sF + 4, y0: -gw / 2 + 60, y1: gw / 2 - 60, z0: gz + gh * f - 16, z1: gz + gh * f + 16 }} r={12} material={m.chrome} />
      ))}
      {[-0.08, -0.2, -0.32].map((f) =>
        [-2, -1, 0, 1, 2].map((k) => (
          <RBox
            key={`${f}${k}`}
            b={{ x0: sF - 16, x1: sF + 4, y0: k * (gw / 5.4) - gw / 12, y1: k * (gw / 5.4) + gw / 12, z0: gz + gh * f - 22, z1: gz + gh * f + 22 }}
            r={10}
            material={m.plastic}
          />
        )),
      )}
      <group position={toWorld('ute', { x: sF - 34, y: 0, z: badgeZ }, 0)}>
        <mesh rotation={[0, Math.PI / 2, 0]} material={m.chrome}>
          <torusGeometry args={[0.085, 0.014, 14, 40]} />
        </mesh>
        <mesh rotation={[0, 0, Math.PI / 2]} material={m.gloss}>
          <cylinderGeometry args={[0.072, 0.072, 0.012, 32]} />
        </mesh>
        <mesh position={[0, -0.105, 0]} rotation={[Math.PI, 0, 0]} material={m.chrome}>
          <coneGeometry args={[0.03, 0.05, 4]} />
        </mesh>
      </group>

      {/* Headlights wrap round the front corners: gloss housing, LED daytime strip, projectors, clear lens */}
      {[-1, 1].map((side) => {
        const yIn = side * 0.335 * W;
        const yOut = side * 0.475 * W;
        const zTop = g.zBonnetFront - 90;
        const zBot = g.zBonnetFront - 210;
        return (
          <group key={side}>
            <FrontPiece {...fp} y0={yIn} y1={yOut} z0={zBot} z1={zTop} depth={170} proud={6} r={40} material={m.housing} surface={front} />
            <FrontPiece {...fp} y0={yIn + side * 15} y1={yOut - side * 15} z0={zTop - 34} z1={zTop - 18} depth={60} proud={12} r={7} material={m.led} />
            <FrontPiece {...fp} y0={yIn + side * 8} y1={yIn + side * 30} z0={zBot + 20} z1={zTop - 30} depth={50} proud={12} r={7} material={m.led} />
            {[0.39, 0.44].map((f) => (
              <mesh
                key={f}
                position={toWorld('ute', { x: shape.frontX(side * f * W, zBot + 52) - 6, y: side * f * W, z: zBot + 52 }, 0)}
                rotation={[0, 0, Math.PI / 2]}
                material={m.chrome}
              >
                <cylinderGeometry args={[0.026, 0.026, 0.02, 20]} />
              </mesh>
            ))}
            <FrontPiece {...fp} y0={yIn - side * 4} y1={yOut + side * 4} z0={zBot - 4} z1={zTop + 4} depth={174} proud={16} r={42} material={m.lens} shadow={false} />
          </group>
        );
      })}

      {/* Bumper: lower intake, plate, fog light pockets and skid plate */}
      <RBox b={{ x0: sF - 4, x1: sF + 40, y0: -0.29 * W, y1: 0.29 * W, z0: zb + 90, z1: zb + 230 }} r={40} material={m.housing} surface={front} />
      <RBox b={{ x0: sF - 20, x1: sF + 10, y0: -235, y1: 235, z0: zb + 105, z1: zb + 215 }} r={14} material={m.plastic} />
      {[-1, 1].map((side) => (
        <group key={side}>
          <FrontPiece {...fp} y0={side * 0.37 * W} y1={side * 0.455 * W} z0={zb + 100} z1={zb + 265} depth={70} proud={6} r={28} material={m.housing} />
          <mesh position={toWorld('ute', { x: shape.frontX(side * 0.412 * W, zb + 180) - 8, y: side * 0.412 * W, z: zb + 180 }, 0)} rotation={[0, 0, Math.PI / 2]} material={m.led}>
            <cylinderGeometry args={[0.03, 0.03, 0.02, 20]} />
          </mesh>
        </group>
      ))}
      <RBox b={{ x0: sF + 40, x1: sF + 440, y0: -0.26 * W, y1: 0.26 * W, z0: zb - 45, z1: zb + 30 }} r={22} material={m.brushed} />
    </group>
  );
}

function TubDetails({ g, m, shape }: { g: G; m: Materials; shape: UteShape }) {
  const half = g.bodyW / 2;
  const inner = g.tubInnerW / 2;
  const zb = g.bumperBottom;
  const ribs = 7;
  const railOuter = (s: number) => {
    const sec = shape.section(s);
    return sec.half - sec.lean - sec.rt;
  };
  const yy = (side: number, a: number, b: number) => ({ y0: Math.min(side * a, side * b), y1: Math.max(side * a, side * b) });
  return (
    <group>
      <RBox b={{ x0: g.tubFront, x1: g.tubRear, y0: -inner, y1: inner, z0: g.tubFloor - 40, z1: g.tubFloor }} r={8} material={m.bedliner} surface="tub" />
      {Array.from({ length: ribs }, (_, i) => {
        const y = -inner + ((i + 0.5) * (2 * inner)) / ribs;
        return <RBox key={i} b={{ x0: g.tubFront + 30, x1: g.tubRear - 30, y0: y - 30, y1: y + 30, z0: g.tubFloor - 2, z1: g.tubFloor + 10 }} r={4} material={m.bedliner} surface="tub" />;
      })}
      {[-1, 1].map((side) => (
        <group key={side}>
          {/* Black rail caps, tail lights with an L-shaped light guide and reverse lamp, bumper reflectors */}
          <RBox
            b={{ x0: g.tubFront + 20, x1: g.tubRear - 20, ...yy(side, inner - 6, railOuter((g.tubFront + g.tubRear) / 2) + 8), z0: g.tubRail - 6, z1: g.tubRail + 12 }}
            r={8}
            material={m.gloss}
          />
          <RBox b={{ x0: g.sRear - 70, x1: g.sRear + 6, ...yy(side, inner + 25, half - 25), z0: g.tubFloor + 30, z1: g.tubRail - 30 }} r={16} material={m.gloss} />
          <RBox b={{ x0: g.sRear, x1: g.sRear + 12, ...yy(side, half - 85, half - 52), z0: g.tubFloor + 80, z1: g.tubRail - 70 }} r={6} material={m.red} />
          <RBox b={{ x0: g.sRear, x1: g.sRear + 12, ...yy(side, inner + 50, half - 52), z0: g.tubRail - 110, z1: g.tubRail - 80 }} r={6} material={m.red} />
          <RBox b={{ x0: g.sRear, x1: g.sRear + 12, ...yy(side, inner + 50, inner + 120), z0: g.tubFloor + 170, z1: g.tubFloor + 260 }} r={6} material={m.led} />
          <RBox b={{ x0: g.sRear + 70, x1: g.sRear + 82, ...yy(side, half - 170, half - 110), z0: zb + 70, z1: zb + 130 }} r={4} material={m.red} />
        </group>
      ))}
      {/* Tailgate handle */}
      <RBox b={{ x0: g.sRear - 4, x1: g.sRear + 12, y0: -140, y1: 140, z0: g.tubRail - 130, z1: g.tubRail - 85 }} r={10} material={m.gloss} />

      {/* Rear bumper with step pad and plate recess */}
      <RBox b={{ x0: g.sRear - 100, x1: g.sRear + 90, y0: -half + 70, y1: half - 70, z0: zb - 10, z1: zb + 220 }} r={45} material={m.paint} surface="bumper" />
      <RBox b={{ x0: g.sRear + 10, x1: g.sRear + 96, y0: -0.28 * g.bodyW, y1: 0.28 * g.bodyW, z0: zb + 196, z1: zb + 232 }} r={10} material={m.plastic} surface="bumper" />
      <RBox b={{ x0: g.sRear + 80, x1: g.sRear + 98, y0: -240, y1: 240, z0: zb + 60, z1: zb + 175 }} r={10} material={m.plastic} />
      <mesh position={toWorld('ute', { x: g.sRear - 20, y: -0.3 * g.bodyW, z: zb - 40 }, 0)} rotation={[0, 0, Math.PI / 2]} material={m.chrome}>
        <cylinderGeometry args={[0.032, 0.032, 0.2, 18]} />
      </mesh>
    </group>
  );
}

function Underbody({ g, m, ute }: { g: G; m: Materials; ute: UteSpec }) {
  const W = g.bodyW;
  return (
    <group>
      {[-1, 1].map((side) => (
        <RBox key={side} b={{ x0: g.sFront + 350, x1: g.sRear - 250, y0: side * 0.29 * W - 38, y1: side * 0.29 * W + 38, z0: g.wheelR - 120, z1: g.wheelR + 40 }} r={10} material={m.chassis} />
      ))}
      <Strut a={{ x: g.L, y: -ute.trackRear / 2 + 120, z: g.wheelR }} b={{ x: g.L, y: ute.trackRear / 2 - 120, z: g.wheelR }} w={90} d={90} material={m.chassis} />
      <mesh position={toWorld('ute', { x: g.L + 30, y: 0, z: g.wheelR - 20 }, 0)} material={m.chassis}>
        <sphereGeometry args={[0.15, 20, 14]} />
      </mesh>
      <mesh position={toWorld('ute', { x: 40, y: 0, z: g.wheelR - 40 }, 0)} material={m.chassis}>
        <sphereGeometry args={[0.12, 20, 14]} />
      </mesh>
      <Strut a={{ x: 0, y: -ute.trackFront / 2 + 120, z: g.wheelR }} b={{ x: 0, y: ute.trackFront / 2 - 120, z: g.wheelR }} w={50} d={50} material={m.chassis} />
      <RBox b={{ x0: g.L * 0.45, x1: g.L * 0.72, y0: -0.4 * W, y1: -0.06 * W, z0: g.wheelR - 90, z1: g.wheelR + 50 }} r={30} material={m.chassis} />
    </group>
  );
}

/** Dual-cab ute with a factory tub, modelled on the Cannon Alpha's rounded body and scaled to the entered dimensions. */
export function UteModel({ ute, hitch, xray }: Props) {
  const g = useMemo(() => uteGeometry(ute, hitch), [ute, hitch]);
  const shape = useMemo(() => makeUteShape(g), [g]);
  useEffect(() => () => [...shape.body, shape.greenhouse].forEach((geo) => geo.dispose()), [shape]);
  const m = useMaterials(ute.paint, xray);
  const ext = (name: string) => (xray ? null : name);
  const W = g.bodyW;
  const half = W / 2;
  const zb = g.bumperBottom;
  const sF = g.sFront;
  const archR = shape.archR;
  const linerF = useArchFlare(0, g.wheelR, archR - 8, archR + 6, zb, W - 40);
  const linerR = useArchFlare(g.L, g.wheelR, archR - 8, archR + 6, zb, W - 40);
  const ball = g.ball;
  // Bonnet protector follows the bonnet's slope.
  const protX = sF + 240;
  const protTilt = Math.atan2(shape.topZ(protX + 50) - shape.topZ(protX - 50), 100);
  const protZ = shape.topZ(protX) + shape.section(protX).crown;
  const doorLines = [g.sWindscreen + 120, g.bPillar, g.sCabBack - 40, g.tubFront - 45];

  return (
    <group>
      {shape.body.map((geo, i) => (
        <mesh key={i} geometry={geo} material={m.paint} castShadow receiveShadow userData={surfaceData(ext('body'), 'ute')} />
      ))}
      <mesh geometry={shape.greenhouse} material={[m.paint, m.gloss, m.glass]} castShadow />
      <mesh geometry={linerF} material={m.plastic} />
      <mesh geometry={linerR} material={m.plastic} />

      <RBox b={{ x0: sF + 150, x1: sF + 330, y0: -0.32 * W, y1: 0.32 * W, z0: protZ - 16, z1: protZ + 12 }} r={12} material={m.gloss} rotation={[0, 0, -protTilt]} />

      <FrontEnd g={g} m={m} shape={shape} xray={xray} />

      {/* Roof: clickable surface and rails */}
      <mesh
        position={toWorld('ute', { x: (g.sWindscreenTop + g.sRoofBack) / 2, y: 0, z: g.zRoof + 10 }, 0)}
        material={pickOnly}
        userData={surfaceData(ext('roof'), 'ute')}
      >
        <boxGeometry args={[(g.sRoofBack - g.sWindscreenTop) / 1000, 0.04, (2 * g.roofHalf) / 1000]} />
      </mesh>
      {[-1, 1].map((side) => {
        const y = side * (g.roofHalf - 40);
        return (
          <group key={side}>
            <RBox b={{ x0: g.sWindscreenTop + 170, x1: g.sRoofBack - 70, y0: y - 22, y1: y + 22, z0: g.zRails - 42, z1: g.zRails }} r={18} material={m.brushed} surface={ext('roof')} />
            {[g.sWindscreenTop + 190, g.sRoofBack - 110].map((x) => (
              <RBox key={x} b={{ x0: x - 40, x1: x + 40, y0: y - 26, y1: y + 26, z0: g.zRoof, z1: g.zRails - 30 }} r={12} material={m.gloss} />
            ))}
          </group>
        );
      })}

      {/* Mirrors, door shut lines, handles and side steps, all on the curved sides */}
      {[-1, 1].map((side) => {
        const yy = (a: number, b: number) => ({ y0: Math.min(side * a, side * b), y1: Math.max(side * a, side * b) });
        return (
          <group key={side}>
            <RBox b={{ x0: g.sWindscreen + 150, x1: g.sWindscreen + 330, ...yy(half - 60, half + 60), z0: g.zBelt - 10, z1: g.zBelt + 55 }} r={18} material={m.gloss} />
            <RBox b={{ x0: g.sWindscreen + 170, x1: g.sWindscreen + 345, ...yy(half + 40, half + 250), z0: g.zBelt + 40, z1: g.zBelt + 205 }} r={60} material={m.paint} />
            <RBox b={{ x0: g.sWindscreen + 165, x1: g.sWindscreen + 185, ...yy(half + 150, half + 245), z0: g.zBelt + 70, z1: g.zBelt + 95 }} r={8} material={m.amber} />
            {doorLines.map((x) => {
              const sec = shape.section(x);
              const za = sec.z0 + sec.rb + 30;
              const zt = g.zBelt - sec.rt * 0.6;
              return (
                <Strut
                  key={x}
                  a={{ x, y: side * (shape.sideY(x, za) + 1.5), z: za }}
                  b={{ x, y: side * (shape.sideY(x, zt) + 1.5), z: zt }}
                  w={4}
                  d={4}
                  material={m.plastic}
                />
              );
            })}
            {[g.bPillar - 230, g.sCabBack - 290].map((x) => {
              const z = g.zBelt - 160;
              const y = shape.sideY(x + 75, z);
              return <RBox key={x} b={{ x0: x, x1: x + 150, ...yy(y - 6, y + 16), z0: z, z1: z + 36 }} r={14} material={m.chrome} />;
            })}
            <RBox b={{ x0: archR + 170, x1: g.L - archR - 170, ...yy(half - 70, half + 105), z0: zb - 70, z1: zb - 28 }} r={18} material={m.plastic} />
          </group>
        );
      })}

      <Interior g={g} m={m} />
      <TubDetails g={g} m={m} shape={shape} />
      <Underbody g={g} m={m} ute={ute} />

      {/* Tow bar and ball */}
      <RBox b={{ x0: g.sRear - 260, x1: g.sRear - 150, y0: -560, y1: 560, z0: ball.z - 140, z1: ball.z - 60 }} r={10} material={m.chassis} surface="towbar" />
      <RBox b={{ x0: g.sRear - 200, x1: ball.x - 30, y0: -38, y1: 38, z0: ball.z - 120, z1: ball.z - 50 }} r={6} material={m.chassis} surface="towbar" />
      <mesh position={toWorld('ute', { x: ball.x, y: 0, z: ball.z - 20 }, 0)} material={m.chrome}>
        <cylinderGeometry args={[0.014, 0.018, 0.06, 16]} />
      </mesh>
      <mesh position={toWorld('ute', ball, 0)} castShadow material={m.chrome}>
        <sphereGeometry args={[0.025, 24, 16]} />
      </mesh>

      {g.wheels.map((w) => (
        <Wheel key={w.id} host="ute" offset={0} x={w.x} y={w.y} r={g.wheelR} rimR={g.rimR} width={g.tyreW} />
      ))}
    </group>
  );
}
