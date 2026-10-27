import { useMemo } from 'react';
import { Edges } from '@react-three/drei';
import type { HitchSpec, UteSpec } from '../model/types';
import { toWorld, uteGeometry } from '../model/geometry';
import { Block, Mat, Wheel, archPoints, surfaceData, useArchFlare, useProfile } from './parts';

const BODY = '#f3f3f1';
const DARK = '#2a2d31';
const TRIM = '#16181b';

interface Props {
  ute: UteSpec;
  hitch: HitchSpec;
  xray: boolean;
}

/** Generic dual-cab ute with a factory tub, scaled to the entered dimensions. */
export function UteModel({ ute, hitch, xray }: Props) {
  const g = useMemo(() => uteGeometry(ute, hitch), [ute, hitch]);
  const bodyOpacity = xray ? 0.14 : 1;
  const solid = (name: string) => (xray ? null : name);

  const zb = g.bumperBottom;
  const archR = Math.max(g.wheelR + 10, Math.min(g.wheelR + 45, g.tubFloor - 80 - g.wheelR));

  const lowerProfile: [number, number][] = [
    [g.sFront + 80, zb],
    [g.sFront, zb + 120],
    [g.sFront, g.zBonnet - 140],
    [g.sFront + 170, g.zBonnet],
    [g.sWindscreen, g.zBonnet + 50],
    [g.sWindscreen + 40, g.zBelt],
    [g.sCabBack, g.zBelt],
    [g.sCabBack, g.tubFloor - 40],
    [g.sRear, g.tubFloor - 40],
    [g.sRear, zb + 100],
    [g.sRear - 80, zb],
    ...archPoints(g.L, g.wheelR, archR, zb),
    ...archPoints(0, g.wheelR, archR, zb),
  ];
  const lowerGeo = useProfile(lowerProfile, g.bodyW);

  const glassGeo = useProfile(
    [
      [g.sWindscreen + 40, g.zBelt],
      [g.sWindscreenTop, g.zRoof],
      [g.sRoofBack, g.zRoof],
      [g.sCabBack - 10, g.zBelt],
    ],
    g.bodyW - 140,
  );

  const flareFront = useArchFlare(0, g.wheelR, archR, archR + 55, zb, g.bodyW + 50);
  const flareRear = useArchFlare(g.L, g.wheelR, archR, archR + 55, zb, g.bodyW + 50);

  const half = g.bodyW / 2;
  const inner = g.tubInnerW / 2;
  const cabLen = g.sCabBack - g.sWindscreen;
  const bPillar = g.sWindscreen + 0.5 * cabLen;
  const ball = g.ball;

  return (
    <group>
      <mesh geometry={lowerGeo} castShadow receiveShadow userData={surfaceData(solid('body'), 'ute')}>
        <Mat color={BODY} opacity={bodyOpacity} roughness={0.4} metalness={0.15} />
      </mesh>
      <mesh geometry={flareFront} castShadow>
        <Mat color={DARK} opacity={bodyOpacity} roughness={0.8} />
      </mesh>
      <mesh geometry={flareRear} castShadow>
        <Mat color={DARK} opacity={bodyOpacity} roughness={0.8} />
      </mesh>

      {/* Greenhouse, roof and rails */}
      {!xray && (
        <mesh geometry={glassGeo}>
          <Mat color="#8ea3b8" opacity={0.42} roughness={0.08} metalness={0.2} />
          <Edges color="#22262b" threshold={20} />
        </mesh>
      )}
      {!xray &&
        [-1, 1].map((side) => (
          <Block key={`b${side}`} b={{ x0: bPillar - 45, x1: bPillar + 45, y0: side * (half - 80), y1: side * (half - 62), z0: g.zBelt, z1: g.zRoof }} color={TRIM} />
        ))}
      <Block
        b={{ x0: g.sWindscreenTop - 30, x1: g.sRoofBack + 10, y0: -half + 85, y1: half - 85, z0: g.zRoof - 10, z1: g.zRoof + 20 }}
        color={BODY}
        opacity={bodyOpacity}
        surface={solid('roof')}
        roughness={0.4}
      />
      {[-1, 1].map((side) => (
        <Block
          key={side}
          b={{
            x0: g.sWindscreenTop + 150,
            x1: g.sRoofBack - 60,
            y0: side * (half - 160) - 22,
            y1: side * (half - 160) + 22,
            z0: g.zRoof + 20,
            z1: g.zRails,
          }}
          color={TRIM}
          opacity={bodyOpacity}
          surface={solid('roof')}
        />
      ))}

      {/* Front end */}
      <Block b={{ x0: g.sFront - 15, x1: g.sFront + 30, y0: -0.31 * g.bodyW, y1: 0.31 * g.bodyW, z0: zb + 260, z1: g.zBonnet - 150 }} color={TRIM} opacity={bodyOpacity} surface={solid('front')} />
      <mesh position={toWorld('ute', { x: g.sFront - 25, y: 0, z: (zb + 260 + g.zBonnet - 150) / 2 }, 0)} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.09, 0.09, 0.03, 32]} />
        <Mat color="#c9ced4" metalness={0.8} roughness={0.25} opacity={bodyOpacity} />
      </mesh>
      {[-1, 1].map((side) => (
        <Block
          key={side}
          b={{ x0: g.sFront + 5, x1: g.sFront + 60, y0: side * 0.33 * g.bodyW, y1: side * 0.47 * g.bodyW, z0: g.zBonnet - 240, z1: g.zBonnet - 150 }}
          color="#e8eef4"
          emissive="#9fb4c8"
          emissiveIntensity={0.35}
          opacity={bodyOpacity}
        />
      ))}
      <Block b={{ x0: g.sFront - 10, x1: g.sFront + 260, y0: -0.38 * g.bodyW, y1: 0.38 * g.bodyW, z0: zb - 20, z1: zb + 120 }} color="#b8bec6" metalness={0.4} opacity={bodyOpacity} surface={solid('front')} />

      {/* Mirrors and side steps */}
      {[-1, 1].map((side) => (
        <Block
          key={`m${side}`}
          b={{ x0: g.sWindscreen + 120, x1: g.sWindscreen + 300, y0: side * (half + 20), y1: side * (half + 210), z0: g.zBelt + 60, z1: g.zBelt + 230 }}
          color={TRIM}
          opacity={bodyOpacity}
        />
      ))}
      {[-1, 1].map((side) => (
        <Block key={`s${side}`} b={{ x0: archR + 80, x1: g.L - archR - 80, y0: side * (half - 100), y1: side * (half + 50), z0: zb - 60, z1: zb - 20 }} color={DARK} opacity={bodyOpacity} />
      ))}

      {/* Seats, visible through the glass and in x-ray */}
      {g.seats.slice(0, 2).map((s, i) => (
        <group key={i}>
          <Block b={{ x0: s.x - 260, x1: s.x + 200, y0: s.y - 240, y1: s.y + 240, z0: s.z - 330, z1: s.z - 230 }} color="#33373d" surface="seat" />
          <Block b={{ x0: s.x + 170, x1: s.x + 270, y0: s.y - 240, y1: s.y + 240, z0: s.z - 230, z1: s.z + 470 }} color="#33373d" surface="seat" />
        </group>
      ))}
      <Block b={{ x0: g.seats[2].x - 260, x1: g.seats[2].x + 200, y0: -0.41 * g.bodyW, y1: 0.41 * g.bodyW, z0: g.seats[2].z - 330, z1: g.seats[2].z - 230 }} color="#33373d" surface="seat" />
      <Block b={{ x0: g.seats[2].x + 170, x1: g.seats[2].x + 270, y0: -0.41 * g.bodyW, y1: 0.41 * g.bodyW, z0: g.seats[2].z - 230, z1: g.seats[2].z + 450 }} color="#33373d" surface="seat" />

      {/* Tub */}
      <Block b={{ x0: g.tubFront, x1: g.tubRear, y0: -inner, y1: inner, z0: g.tubFloor - 40, z1: g.tubFloor }} color="#2b2b2b" roughness={0.95} surface="tub" />
      <Block b={{ x0: g.tubFront - 50, x1: g.tubFront, y0: -half, y1: half, z0: g.tubFloor - 40, z1: g.tubRail }} color={BODY} opacity={bodyOpacity} surface={solid('tub')} />
      {[-1, 1].map((side) => (
        <Block
          key={`w${side}`}
          b={{ x0: g.tubFront - 50, x1: g.sRear - 20, y0: side * inner, y1: side * half, z0: g.tubFloor - 40, z1: g.tubRail }}
          color={BODY}
          opacity={bodyOpacity}
          roughness={0.4}
          surface={solid('tub')}
        />
      ))}
      <Block b={{ x0: g.tubRear, x1: g.tubRear + 60, y0: -inner, y1: inner, z0: g.tubFloor - 40, z1: g.tubRail - 10 }} color={BODY} opacity={bodyOpacity} surface={solid('tailgate')} />
      {[-1, 1].map((side) => (
        <Block
          key={`t${side}`}
          b={{ x0: g.sRear - 20, x1: g.sRear + 6, y0: side * (inner + 20), y1: side * (half - 10), z0: g.tubFloor + 100, z1: g.tubRail - 60 }}
          color="#b3121b"
          emissive="#5a0005"
          emissiveIntensity={0.4}
          opacity={bodyOpacity}
        />
      ))}
      <Block b={{ x0: g.sRear - 60, x1: g.sRear + 70, y0: -half + 70, y1: half - 70, z0: zb, z1: zb + 200 }} color="#3a3e44" opacity={bodyOpacity} surface={solid('bumper')} />

      {/* Tow bar and ball */}
      <Block b={{ x0: g.sRear - 260, x1: g.sRear - 150, y0: -560, y1: 560, z0: ball.z - 140, z1: ball.z - 60 }} color={TRIM} surface="towbar" />
      <Block b={{ x0: g.sRear - 200, x1: ball.x - 30, y0: -38, y1: 38, z0: ball.z - 120, z1: ball.z - 50 }} color={TRIM} surface="towbar" />
      <mesh position={toWorld('ute', { x: ball.x, y: 0, z: ball.z - 20 }, 0)}>
        <cylinderGeometry args={[0.014, 0.018, 0.06, 16]} />
        <Mat color="#9aa1aa" metalness={0.8} roughness={0.25} />
      </mesh>
      <mesh position={toWorld('ute', ball, 0)} castShadow>
        <sphereGeometry args={[0.025, 24, 16]} />
        <Mat color="#c9ced4" metalness={0.85} roughness={0.2} />
      </mesh>

      {g.wheels.map((w) => (
        <Wheel key={w.id} host="ute" offset={0} x={w.x} y={w.y} r={g.wheelR} width={g.tyreW} />
      ))}
    </group>
  );
}
