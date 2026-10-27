import { useMemo } from 'react';
import * as THREE from 'three';
import type { HitchSpec, UteSpec } from '../model/types';
import { toWorld, uteGeometry } from '../model/geometry';
import { archPoints, surfaceData, useArchFlare } from './parts';
import { RBox, Strut, Wheel, useBevelProfile, useMaterials, usePanel, useRingRect, type Materials } from './kit';

interface Props {
  ute: UteSpec;
  hitch: HitchSpec;
  xray: boolean;
}

type G = ReturnType<typeof uteGeometry>;

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

/** Box-flare shaped wheel arch trim: a ring sector with a flattened top. */
function useFlare(cx: number, cz: number, rIn: number, rOut: number, zLine: number, widthMm: number) {
  return useMemo(() => {
    const outer: [number, number][] = [];
    const t0 = Math.asin(Math.max(-0.99, Math.min(0.99, (zLine - cz) / rOut)));
    const steps = 24;
    for (let i = 0; i <= steps; i++) {
      const t = t0 + ((Math.PI - 2 * t0) * i) / steps;
      outer.push([cx + rOut * 1.05 * Math.cos(t), Math.min(cz + rOut * Math.sin(t), cz + rIn + 52)]);
    }
    const inner = archPoints(cx, cz, rIn, zLine, steps).reverse();
    const shape = new THREE.Shape(
      [...outer, ...inner].map(([x, z]) => {
        const [wx, wy] = toWorld('ute', { x, y: 0, z }, 0);
        return new THREE.Vector2(wx, wy);
      }),
    );
    const g = new THREE.ExtrudeGeometry(shape, { depth: widthMm / 1000, bevelEnabled: true, bevelThickness: 0.014, bevelSize: 0.012, bevelSegments: 3 });
    g.translate(0, 0, -widthMm / 2000);
    return g;
  }, [cx, cz, rIn, rOut, zLine, widthMm]);
}

function Greenhouse({ g, m }: { g: G; m: Materials }) {
  const half = g.bodyW / 2;
  const rake = 1.15;
  const sWs = (z: number) => g.sWindscreen + (z - g.zCowl) * rake;
  const tHeight = (z: number) => (z - g.zBelt) / (g.zRoof - g.zBelt);
  const sideHalf = (z: number) => lerp(g.beltHalf, g.roofHalf, tHeight(z));
  const sC = (z: number) => lerp(g.sCabBack - 10, g.sRoofBack, tHeight(z));
  const zb = g.zBelt;
  const zt = g.zRoof;
  const deps = [g.sWindscreen, g.zCowl, g.zBelt, g.zRoof, g.beltHalf, g.roofHalf, g.sCabBack, g.sRoofBack, g.bPillar];

  const frontWin: [number, number][] = [
    [sWs(zb + 25) + 75, zb + 25],
    [sWs(zt - 45) + 60, zt - 45],
    [g.bPillar - 45, zt - 45],
    [g.bPillar - 45, zb + 25],
  ];
  const rearWin: [number, number][] = [
    [g.bPillar + 45, zb + 25],
    [g.bPillar + 45, zt - 45],
    [sC(zt - 45) - 150, zt - 45],
    [sC(zb + 25) - 190, zb + 25],
  ];
  const sideOutline: [number, number][] = [
    [sWs(zb), zb],
    [sWs(zt), zt],
    [g.sRoofBack, zt],
    [g.sCabBack - 10, zb],
  ];
  const left = usePanel(sideOutline, [frontWin, rearWin], (u, v) => ({ x: u, y: -sideHalf(v), z: v }), deps);
  const right = usePanel(sideOutline, [frontWin, rearWin], (u, v) => ({ x: u, y: sideHalf(v), z: v }), deps);
  const leftGlass = usePanel(frontWin, [], (u, v) => ({ x: u, y: -(sideHalf(v) - 6), z: v }), deps);
  const leftGlass2 = usePanel(rearWin, [], (u, v) => ({ x: u, y: -(sideHalf(v) - 6), z: v }), deps);
  const rightGlass = usePanel(frontWin, [], (u, v) => ({ x: u, y: sideHalf(v) - 6, z: v }), deps);
  const rightGlass2 = usePanel(rearWin, [], (u, v) => ({ x: u, y: sideHalf(v) - 6, z: v }), deps);

  const hw0 = half - 95;
  const hw1 = g.roofHalf + 15;
  const wsOutline: [number, number][] = [
    [-hw0, g.zCowl],
    [hw0, g.zCowl],
    [hw1, zt],
    [-hw1, zt],
  ];
  const wsGlass: [number, number][] = [
    [-(hw0 - 45), g.zCowl + 35],
    [hw0 - 45, g.zCowl + 35],
    [hw1 - 30, zt - 40],
    [-(hw1 - 30), zt - 40],
  ];
  const wsFrame = usePanel(wsOutline, [wsGlass], (u, v) => ({ x: sWs(v), y: u, z: v }), deps);
  const ws = usePanel(wsGlass, [], (u, v) => ({ x: sWs(v) + 4, y: u, z: v }), deps);

  const rearOutline: [number, number][] = [
    [-g.beltHalf, zb],
    [g.beltHalf, zb],
    [g.roofHalf, zt],
    [-g.roofHalf, zt],
  ];
  const rearGlassPts: [number, number][] = [
    [-(g.beltHalf - 110), zb + 70],
    [g.beltHalf - 110, zb + 70],
    [g.roofHalf - 80, zt - 55],
    [-(g.roofHalf - 80), zt - 55],
  ];
  const rearFrame = usePanel(rearOutline, [rearGlassPts], (u, v) => ({ x: sC(v), y: u, z: v }), deps);
  const rearGlass = usePanel(rearGlassPts, [], (u, v) => ({ x: sC(v) - 4, y: u, z: v }), deps);

  return (
    <group>
      {[left, right, wsFrame, rearFrame].map((geo, i) => (
        <mesh key={i} geometry={geo} material={m.trim} castShadow />
      ))}
      {[leftGlass, leftGlass2, rightGlass, rightGlass2, ws, rearGlass].map((geo, i) => (
        <mesh key={`g${i}`} geometry={geo} material={m.glass} />
      ))}
      {[-1, 1].map((side) => (
        <Strut
          key={side}
          a={{ x: g.sWindscreen + 10, y: side * (half - 95), z: g.zCowl }}
          b={{ x: sWs(zt) + 10, y: side * (g.roofHalf + 15), z: zt }}
          w={55}
          d={55}
          material={m.gloss}
        />
      ))}
    </group>
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

function FrontEnd({ g, m, xray }: { g: G; m: Materials; xray: boolean }) {
  const W = g.bodyW;
  const sF = g.sFront;
  const zb = g.bumperBottom;
  const front = xray ? null : 'front';
  const gw = 0.62 * W;
  const gz0 = zb + 250;
  const gz1 = g.zBonnetFront - 45;
  const gh = gz1 - gz0;
  const gz = (gz0 + gz1) / 2;
  const ring = useRingRect(gw, gh, 58, 95, 46);
  const badgeZ = gz + gh * 0.16;
  return (
    <group>
      {/* Chrome-framed grille with horizontal bars and the pin badge */}
      <mesh geometry={ring} material={m.chrome} position={toWorld('ute', { x: sF - 14, y: 0, z: gz }, 0)} rotation={[0, Math.PI / 2, 0]} castShadow userData={surfaceData(front, 'ute')} />
      <RBox b={{ x0: sF + 6, x1: sF + 50, y0: -gw / 2 + 40, y1: gw / 2 - 40, z0: gz0 + 40, z1: gz1 - 40 }} r={30} material={m.gloss} surface={front} />
      {[0.3, 0.12].map((f) => (
        <RBox key={f} b={{ x0: sF - 6, x1: sF + 18, y0: -gw / 2 + 60, y1: gw / 2 - 60, z0: gz + gh * f - 16, z1: gz + gh * f + 16 }} r={10} material={m.chrome} />
      ))}
      {[-0.08, -0.2, -0.32].map((f) =>
        [-2, -1, 0, 1, 2].map((k) => (
          <RBox
            key={`${f}${k}`}
            b={{ x0: sF - 2, x1: sF + 14, y0: k * (gw / 5.4) - gw / 12, y1: k * (gw / 5.4) + gw / 12, z0: gz + gh * f - 22, z1: gz + gh * f + 22 }}
            r={8}
            material={m.plastic}
          />
        )),
      )}
      <group position={toWorld('ute', { x: sF - 26, y: 0, z: badgeZ }, 0)}>
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

      {/* Headlights: gloss housing, L-shaped LED daytime light, projectors, clear lens */}
      {[-1, 1].map((side) => {
        const y0 = side * 0.335 * W;
        const y1 = side * 0.478 * W;
        const lo = Math.min(y0, y1);
        const hi = Math.max(y0, y1);
        const inner = side < 0 ? hi : lo;
        const zTop = g.zBonnetFront - 55;
        const zBot = g.zBonnetFront - 185;
        return (
          <group key={side}>
            <RBox b={{ x0: sF - 6, x1: sF + 170, y0: lo, y1: hi, z0: zBot, z1: zTop }} r={30} material={m.gloss} surface={front} />
            <RBox b={{ x0: sF - 12, x1: sF + 120, y0: lo + 15, y1: hi - 15, z0: zTop - 34, z1: zTop - 18 }} r={6} material={m.led} />
            <RBox b={{ x0: sF - 12, x1: sF + 40, y0: inner - (side < 0 ? 30 : -14), y1: inner + (side < 0 ? -14 : 30), z0: zBot + 20, z1: zTop - 30 }} r={6} material={m.led} />
            {[0.39, 0.44].map((f) => (
              <mesh key={f} position={toWorld('ute', { x: sF - 4, y: side * f * W, z: zBot + 52 }, 0)} rotation={[0, 0, Math.PI / 2]} material={m.chrome}>
                <cylinderGeometry args={[0.026, 0.026, 0.02, 20]} />
              </mesh>
            ))}
            <RBox b={{ x0: sF - 16, x1: sF + 172, y0: lo - 4, y1: hi + 4, z0: zBot - 4, z1: zTop + 4 }} r={32} material={m.lens} shadow={false} />
          </group>
        );
      })}

      {/* Bumper: lower intake, plate, fog light pockets and skid plate */}
      <RBox b={{ x0: sF - 4, x1: sF + 40, y0: -0.29 * W, y1: 0.29 * W, z0: zb + 35, z1: zb + 205 }} r={30} material={m.gloss} surface={front} />
      <RBox b={{ x0: sF - 20, x1: sF + 10, y0: -235, y1: 235, z0: zb + 95, z1: zb + 200 }} r={10} material={m.plastic} />
      {[-1, 1].map((side) => (
        <group key={side}>
          <RBox b={{ x0: sF - 6, x1: sF + 70, y0: Math.min(side * 0.37 * W, side * 0.46 * W), y1: Math.max(side * 0.37 * W, side * 0.46 * W), z0: zb + 45, z1: zb + 265 }} r={20} material={m.gloss} />
          <mesh position={toWorld('ute', { x: sF - 8, y: side * 0.415 * W, z: zb + 150 }, 0)} rotation={[0, 0, Math.PI / 2]} material={m.led}>
            <cylinderGeometry args={[0.03, 0.03, 0.02, 20]} />
          </mesh>
        </group>
      ))}
      <RBox b={{ x0: sF + 30, x1: sF + 440, y0: -0.26 * W, y1: 0.26 * W, z0: zb - 45, z1: zb + 30 }} r={20} material={m.brushed} />
    </group>
  );
}

function Tub({ g, m, xray }: { g: G; m: Materials; xray: boolean }) {
  const half = g.bodyW / 2;
  const inner = g.tubInnerW / 2;
  const ext = (name: string) => (xray ? null : name);
  const zb = g.bumperBottom;
  const ribs = 7;
  return (
    <group>
      <RBox b={{ x0: g.tubFront, x1: g.tubRear, y0: -inner, y1: inner, z0: g.tubFloor - 40, z1: g.tubFloor }} r={8} material={m.bedliner} surface="tub" />
      {Array.from({ length: ribs }, (_, i) => {
        const y = -inner + ((i + 0.5) * (2 * inner)) / ribs;
        return <RBox key={i} b={{ x0: g.tubFront + 30, x1: g.tubRear - 30, y0: y - 30, y1: y + 30, z0: g.tubFloor - 2, z1: g.tubFloor + 10 }} r={4} material={m.bedliner} surface="tub" />;
      })}
      <RBox b={{ x0: g.tubFront - 50, x1: g.tubFront, y0: -half, y1: half, z0: g.tubFloor - 40, z1: g.tubRail }} r={20} material={m.paint} surface={ext('tub')} />
      {[-1, 1].map((side) => (
        <group key={side}>
          <RBox
            b={{ x0: g.tubFront - 50, x1: g.sRear - 15, y0: Math.min(side * inner, side * half), y1: Math.max(side * inner, side * half), z0: g.tubFloor - 40, z1: g.tubRail }}
            r={32}
            material={m.paint}
            surface={ext('tub')}
          />
          <RBox
            b={{ x0: g.tubFront - 40, x1: g.sRear - 70, y0: Math.min(side * (inner - 10), side * (half - 12)), y1: Math.max(side * (inner - 10), side * (half - 12)), z0: g.tubRail - 6, z1: g.tubRail + 12 }}
            r={6}
            material={m.gloss}
          />
          {/* Tail light: gloss housing with an L-shaped red light guide and reverse lamp */}
          <RBox
            b={{ x0: g.sRear - 70, x1: g.sRear + 6, y0: Math.min(side * (inner + 25), side * (half - 10)), y1: Math.max(side * (inner + 25), side * (half - 10)), z0: g.tubFloor + 30, z1: g.tubRail - 30 }}
            r={14}
            material={m.gloss}
          />
          <RBox b={{ x0: g.sRear, x1: g.sRear + 12, y0: Math.min(side * (half - 70), side * (half - 38)), y1: Math.max(side * (half - 70), side * (half - 38)), z0: g.tubFloor + 80, z1: g.tubRail - 70 }} r={5} material={m.red} />
          <RBox b={{ x0: g.sRear, x1: g.sRear + 12, y0: Math.min(side * (inner + 50), side * (half - 38)), y1: Math.max(side * (inner + 50), side * (half - 38)), z0: g.tubRail - 110, z1: g.tubRail - 80 }} r={5} material={m.red} />
          <RBox b={{ x0: g.sRear, x1: g.sRear + 12, y0: Math.min(side * (inner + 50), side * (inner + 120)), y1: Math.max(side * (inner + 50), side * (inner + 120)), z0: g.tubFloor + 170, z1: g.tubFloor + 260 }} r={5} material={m.led} />
          <RBox b={{ x0: g.sRear + 70, x1: g.sRear + 82, y0: Math.min(side * (half - 170), side * (half - 110)), y1: Math.max(side * (half - 170), side * (half - 110)), z0: zb + 70, z1: zb + 130 }} r={4} material={m.red} />
        </group>
      ))}
      <RBox b={{ x0: g.tubRear, x1: g.tubRear + 70, y0: -inner, y1: inner, z0: g.tubFloor - 30, z1: g.tubRail - 15 }} r={22} material={m.paint} surface={ext('tailgate')} />
      <RBox b={{ x0: g.tubRear + 66, x1: g.tubRear + 80, y0: -140, y1: 140, z0: g.tubRail - 125, z1: g.tubRail - 80 }} r={8} material={m.gloss} />
      <RBox b={{ x0: g.tubRear + 50, x1: g.tubRear + 84, y0: -inner + 20, y1: inner - 20, z0: g.tubRail - 30, z1: g.tubRail - 6 }} r={8} material={m.gloss} />

      {/* Rear bumper with step pad and plate recess */}
      <RBox b={{ x0: g.sRear - 100, x1: g.sRear + 90, y0: -half + 70, y1: half - 70, z0: zb - 10, z1: zb + 220 }} r={40} material={m.paint} surface={ext('bumper')} />
      <RBox b={{ x0: g.sRear + 10, x1: g.sRear + 96, y0: -0.28 * g.bodyW, y1: 0.28 * g.bodyW, z0: zb + 196, z1: zb + 232 }} r={8} material={m.plastic} surface={ext('bumper')} />
      <RBox b={{ x0: g.sRear + 80, x1: g.sRear + 98, y0: -240, y1: 240, z0: zb + 60, z1: zb + 175 }} r={8} material={m.plastic} />
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

/** Dual-cab ute with a factory tub, modelled on a modern full-size ute and scaled to the entered dimensions. */
export function UteModel({ ute, hitch, xray }: Props) {
  const g = useMemo(() => uteGeometry(ute, hitch), [ute, hitch]);
  const m = useMaterials(ute.paint, xray);
  const ext = (name: string) => (xray ? null : name);
  const W = g.bodyW;
  const half = W / 2;
  const zb = g.bumperBottom;
  const sF = g.sFront;
  const archR = Math.max(g.wheelR + 10, Math.min(g.wheelR + 55, g.tubFloor - 80 - g.wheelR));
  const bonnetZ = (s: number) => lerp(g.zBonnetFront, g.zBonnet, (s - (sF + 140)) / (g.sWindscreen - 60 - (sF + 140)));
  const bonnetTilt = Math.atan2(g.zBonnet - g.zBonnetFront, g.sWindscreen - 60 - (sF + 140));

  const body = useBevelProfile(
    [
      [sF + 90, zb],
      [sF + 20, zb + 140],
      [sF, zb + 300],
      [sF, g.zBonnetFront - 160],
      [sF + 40, g.zBonnetFront - 40],
      [sF + 140, g.zBonnetFront],
      [g.sWindscreen - 60, g.zBonnet],
      [g.sWindscreen, g.zCowl],
      [g.sWindscreen + 170, g.zBelt],
      [g.sCabBack, g.zBelt],
      [g.sCabBack, g.tubFloor - 40],
      [g.sRear, g.tubFloor - 40],
      [g.sRear, zb + 120],
      [g.sRear - 60, zb],
      ...archPoints(g.L, g.wheelR, archR, zb),
      ...archPoints(0, g.wheelR, archR, zb),
    ],
    W,
    38,
  );
  const linerF = useArchFlare(0, g.wheelR, archR - 8, archR + 6, zb, W - 40);
  const linerR = useArchFlare(g.L, g.wheelR, archR - 8, archR + 6, zb, W - 40);
  const flareF = useFlare(0, g.wheelR, archR, archR + 78, zb, 66);
  const flareR = useFlare(g.L, g.wheelR, archR, archR + 78, zb, 66);
  const ball = g.ball;

  return (
    <group>
      <mesh geometry={body} material={m.paint} castShadow receiveShadow userData={surfaceData(ext('body'), 'ute')} />
      <mesh geometry={linerF} material={m.plastic} />
      <mesh geometry={linerR} material={m.plastic} />
      {[-1, 1].map((side) =>
        [flareF, flareR].map((geo, i) => (
          <mesh key={`${side}${i}`} geometry={geo} material={m.paint} position={[0, 0, (side * (half + 8)) / 1000]} castShadow userData={surfaceData(ext('body'), 'ute')} />
        )),
      )}
      {/* Bonnet protector */}
      <RBox
        b={{ x0: sF + 150, x1: sF + 330, y0: -0.4 * W, y1: 0.4 * W, z0: bonnetZ(sF + 240) - 18, z1: bonnetZ(sF + 240) + 14 }}
        r={12}
        material={m.gloss}
        rotation={[0, 0, -bonnetTilt]}
      />

      <FrontEnd g={g} m={m} xray={xray} />
      {!xray && <Greenhouse g={g} m={m} />}
      <RBox b={{ x0: g.sWindscreenTop - 20, x1: g.sRoofBack + 15, y0: -g.roofHalf - 30, y1: g.roofHalf + 30, z0: g.zRoof - 40, z1: g.zRoof + 8 }} r={30} material={m.paint} surface={ext('roof')} />
      {[-1, 1].map((side) => {
        const y = side * (g.roofHalf - 40);
        return (
          <group key={side}>
            <RBox b={{ x0: g.sWindscreenTop + 170, x1: g.sRoofBack - 70, y0: y - 22, y1: y + 22, z0: g.zRails - 42, z1: g.zRails }} r={16} material={m.brushed} surface={ext('roof')} />
            {[g.sWindscreenTop + 190, g.sRoofBack - 110].map((x) => (
              <RBox key={x} b={{ x0: x - 40, x1: x + 40, y0: y - 26, y1: y + 26, z0: g.zRoof, z1: g.zRails - 30 }} r={10} material={m.gloss} />
            ))}
          </group>
        );
      })}

      {/* Mirrors, door shut lines, handles and side steps */}
      {[-1, 1].map((side) => {
        const yy = (a: number, b: number) => ({ y0: Math.min(side * a, side * b), y1: Math.max(side * a, side * b) });
        return (
          <group key={side}>
            <RBox b={{ x0: g.sWindscreen + 150, x1: g.sWindscreen + 330, ...yy(half - 40, half + 70), z0: g.zBelt, z1: g.zBelt + 60 }} r={14} material={m.gloss} />
            <RBox b={{ x0: g.sWindscreen + 170, x1: g.sWindscreen + 340, ...yy(half + 40, half + 250), z0: g.zBelt + 40, z1: g.zBelt + 205 }} r={45} material={m.paint} />
            <RBox b={{ x0: g.sWindscreen + 165, x1: g.sWindscreen + 185, ...yy(half + 150, half + 248), z0: g.zBelt + 60, z1: g.zBelt + 90 }} r={6} material={m.amber} />
            {[g.sWindscreen + 120, g.bPillar, g.sCabBack - 40].map((x) => (
              <mesh key={x} position={toWorld('ute', { x, y: side * (half + 1), z: (zb + 90 + g.zBelt - 35) / 2 }, 0)} material={m.plastic}>
                <boxGeometry args={[0.004, (g.zBelt - 35 - zb - 90) / 1000, 0.004]} />
              </mesh>
            ))}
            {[g.bPillar - 230, g.sCabBack - 290].map((x) => (
              <RBox key={x} b={{ x0: x, x1: x + 150, ...yy(half - 4, half + 16), z0: g.zBelt - 165, z1: g.zBelt - 128 }} r={12} material={m.chrome} />
            ))}
            <RBox b={{ x0: archR + 170, x1: g.L - archR - 170, ...yy(half - 70, half + 105), z0: zb - 70, z1: zb - 28 }} r={16} material={m.plastic} />
          </group>
        );
      })}

      <Interior g={g} m={m} />
      <Tub g={g} m={m} xray={xray} />
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
