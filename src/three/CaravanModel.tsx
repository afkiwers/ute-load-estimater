import { useMemo } from 'react';
import { Edges } from '@react-three/drei';
import type { CaravanSpec, HitchSpec } from '../model/types';
import { caravanGeometry, toWorld } from '../model/geometry';
import { Block, Mat, Wheel, boxWorld } from './parts';

const FRAME = '#26292d';

interface Props {
  caravan: CaravanSpec;
  hitch: HitchSpec;
  offset: number;
  xray: boolean;
}

/** A-frame, chassis, see-through body shell and axle group, scaled to the entered dimensions. */
export function CaravanModel({ caravan: cv, hitch, offset, xray }: Props) {
  const c = useMemo(() => caravanGeometry(cv, hitch), [cv, hitch]);
  const half = cv.bodyWidth / 2;
  const railY = Math.min(half - 150, cv.track / 2 - 250);
  const railZ = c.drawbarZ;
  const wall = 40;
  const shell = { x0: c.bodyStart, x1: c.bodyEnd, y0: -half, y1: half, z0: c.floorZ, z1: c.roofZ };
  const wallOpacity = xray ? 0.06 : 0.28;

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

  const shellBox = boxWorld('caravan', shell, offset);

  return (
    <group>
      {/* Coupling and A-frame */}
      <Block host="caravan" offset={offset} b={{ x0: -40, x1: 260, y0: -60, y1: 60, z0: c.couplingZ - 10, z1: c.couplingZ + 70 }} color="#3b3f45" metalness={0.4} />
      {aFrame.map((a) => (
        <mesh key={a.side} position={a.position} rotation={[0, a.rotY, 0]} castShadow>
          <boxGeometry args={[a.length, 0.1, 0.05]} />
          <Mat color={FRAME} />
        </mesh>
      ))}
      <Block
        host="caravan"
        offset={offset}
        b={{ x0: c.drawbarStart, x1: c.bodyStart - 20, y0: -0.3 * cv.bodyWidth, y1: 0.3 * cv.bodyWidth, z0: c.drawbarZ - 14, z1: c.drawbarZ }}
        color="#8e959d"
        metalness={0.5}
        roughness={0.4}
        surface="cvDrawbar"
      />
      <mesh position={toWorld('caravan', { x: 520, y: 0, z: c.drawbarZ / 2 }, offset)}>
        <cylinderGeometry args={[0.03, 0.03, c.drawbarZ / 1000, 12]} />
        <Mat color="#3b3f45" />
      </mesh>

      {/* WDH spring bars */}
      {hitch.wdh.enabled &&
        [-1, 1].map((side) => (
          <Block
            key={side}
            host="caravan"
            offset={offset}
            b={{ x0: 120, x1: 1000, y0: side * 120 - 15, y1: side * 120 + 15, z0: c.couplingZ - 70, z1: c.couplingZ - 40 }}
            color="#c58b16"
            metalness={0.4}
          />
        ))}

      {/* Chassis rails */}
      {[-1, 1].map((side) => (
        <Block
          key={side}
          host="caravan"
          offset={offset}
          b={{ x0: c.bodyStart, x1: c.bodyEnd, y0: side * railY - 25, y1: side * railY + 25, z0: railZ - 50, z1: railZ + 50 }}
          color={FRAME}
        />
      ))}

      {/* Floor (drop target) */}
      <Block host="caravan" offset={offset} b={{ x0: c.bodyStart, x1: c.bodyEnd, y0: -half, y1: half, z0: c.floorZ - wall, z1: c.floorZ }} color="#b9a27f" roughness={0.9} surface="cvFloor" />

      {/* Shell: see-through walls, solid roof unless x-ray */}
      <mesh position={shellBox.position} userData={{}}>
        <boxGeometry args={shellBox.args} />
        <meshStandardMaterial color="#ffffff" transparent opacity={wallOpacity} depthWrite={false} roughness={0.3} />
        <Edges color="#8a9099" />
      </mesh>
      {!xray && (
        <Block
          host="caravan"
          offset={offset}
          b={{ x0: c.bodyStart, x1: c.bodyEnd, y0: -half, y1: half, z0: c.roofZ - wall, z1: c.roofZ }}
          color="#f6f6f4"
          surface="cvRoof"
          roughness={0.35}
        />
      )}
      {!xray && (
        <Block
          host="caravan"
          offset={offset}
          b={{ x0: c.bodyStart - 6, x1: c.bodyStart, y0: -half * 0.55, y1: half * 0.55, z0: c.floorZ + 900, z1: c.floorZ + 1500 }}
          color="#1d2733"
          opacity={0.7}
        />
      )}

      {/* Rear bumper (drop target for bike racks, spare wheel) */}
      <Block host="caravan" offset={offset} b={{ x0: c.bodyEnd, x1: c.bodyEnd + 150, y0: -half + 100, y1: half - 100, z0: c.floorZ - 260, z1: c.floorZ - 120 }} color={FRAME} surface="cvBumper" />

      {/* Running gear */}
      {c.axles.map((x) =>
        [-1, 1].map((side) => <Wheel key={`${x}${side}`} host="caravan" offset={offset} x={x} y={(side * cv.track) / 2} r={c.wheelR} width={c.tyreW} rim="#b9bec5" />),
      )}
    </group>
  );
}
