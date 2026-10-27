import type { ReactNode, RefObject } from 'react';
import { Html } from '@react-three/drei';
import type { Check, Result } from '../model/calc';
import { caravanGeometry, toWorld, uteGeometry } from '../model/geometry';
import { mm, num } from '../model/format';
import type { Host, Setup, Vec3 } from '../model/types';
import { Block } from './parts';
import { labelLayer } from '../state/ui';

function Tag({ host, p, offset, status, children }: { host: Host; p: Vec3; offset: number; status: string; children: ReactNode }) {
  return (
    <Html position={toWorld(host, p, offset)} center portal={labelLayer as RefObject<HTMLElement>} style={{ pointerEvents: 'none' }} zIndexRange={[10, 0]}>
      <div className={`tag tag-${status}`}>{children}</div>
    </Html>
  );
}

const statusOf = (checks: Check[], id: string) => checks.find((c) => c.id === id)?.status ?? 'unset';

/** A dimension line on the ground with end ticks and a caption. */
function Dimension({ host, offset, x0, x1, y, label, labelX }: { host: Host; offset: number; x0: number; x1: number; y: number; label: string; labelX?: number }) {
  const color = '#8a929c';
  return (
    <group>
      <Block host={host} offset={offset} b={{ x0, x1, y0: y - 6, y1: y + 6, z0: 0, z1: 4 }} color={color} shadow={false} />
      <Block host={host} offset={offset} b={{ x0: x0 - 6, x1: x0 + 6, y0: y - 120, y1: y + 120, z0: 0, z1: 4 }} color={color} shadow={false} />
      <Block host={host} offset={offset} b={{ x0: x1 - 6, x1: x1 + 6, y0: y - 120, y1: y + 120, z0: 0, z1: 4 }} color={color} shadow={false} />
      <Html position={toWorld(host, { x: labelX ?? (x0 + x1) / 2, y, z: 10 }, offset)} center portal={labelLayer as RefObject<HTMLElement>} style={{ pointerEvents: 'none' }} zIndexRange={[10, 0]}>
        <div className="dim">{label}</div>
      </Html>
    </group>
  );
}

export function Labels({ setup, result, offset }: { setup: Setup; result: Result; offset: number }) {
  const g = uteGeometry(setup.ute, setup.hitch);
  const { checks } = result;
  const t = result.ute.total;
  const left = -(g.bodyW / 2 + 1000);
  const wheelTag = (id: 'fl' | 'fr' | 'rl' | 'rr', x: number, y: number) => (
    <Tag key={id} host="ute" offset={offset} p={{ x, y: y + Math.sign(y) * (g.tyreW / 2 + 260), z: 120 }} status={statusOf(checks, `tyre_${id}`)}>
      <b>{id.toUpperCase()}</b> {num(t[id])} kg
    </Tag>
  );

  return (
    <group>
      {g.wheels.map((w) => wheelTag(w.id, w.x, w.y))}
      <Tag host="ute" offset={offset} p={{ x: 0, y: left - 450, z: 0 }} status={statusOf(checks, 'frontAxle')}>
        Front axle <b>{num(result.ute.front)}</b>
        {setup.ute.limits.frontAxle ? ` / ${num(setup.ute.limits.frontAxle)}` : ''} kg
      </Tag>
      <Tag host="ute" offset={offset} p={{ x: g.L, y: left - 450, z: 0 }} status={statusOf(checks, 'rearAxle')}>
        Rear axle <b>{num(result.ute.rear)}</b>
        {setup.ute.limits.rearAxle ? ` / ${num(setup.ute.limits.rearAxle)}` : ''} kg
      </Tag>
      <Dimension host="ute" offset={offset} x0={0} x1={g.L} y={left} label={`Wheelbase ${mm(g.L)}`} />
      <Dimension host="ute" offset={offset} x0={g.L} x1={g.ball.x} y={left} label={`Axle → ball ${mm(setup.hitch.ballOffset)}`} />

      {result.caravan && result.hitch && <CaravanLabels setup={setup} result={result} offset={offset} />}
    </group>
  );
}

function CaravanLabels({ setup, result, offset }: { setup: Setup; result: Result; offset: number }) {
  const cv = setup.caravan;
  const c = caravanGeometry(cv, setup.hitch);
  const cr = result.caravan!;
  const { checks } = result;
  const left = -(cv.bodyWidth / 2 + 900);
  return (
    <group>
      <Tag host="caravan" offset={offset} p={{ x: 0, y: 0, z: c.couplingZ + 650 }} status={statusOf(checks, 'towBall')}>
        Ball <b>{num(result.hitch!.ball)}</b>
        {setup.ute.limits.towBallMax ? ` / ${num(setup.ute.limits.towBallMax)}` : ''} kg
      </Tag>
      <Tag host="caravan" offset={offset} p={{ x: c.a, y: -(cv.track / 2 + 400), z: 120 }} status={statusOf(checks, 'cvTyre_left')}>
        <b>L</b> {num(cr.axleLeft)} kg
      </Tag>
      <Tag host="caravan" offset={offset} p={{ x: c.a, y: cv.track / 2 + 400, z: 120 }} status={statusOf(checks, 'cvTyre_right')}>
        <b>R</b> {num(cr.axleRight)} kg
      </Tag>
      <Tag host="caravan" offset={offset} p={{ x: (c.bodyStart + c.bodyEnd) / 2, y: 0, z: c.roofZ + 450 }} status={statusOf(checks, 'atm')}>
        Caravan <b>{num(cr.mass)}</b>
        {cv.limits.atm ? ` / ATM ${num(cv.limits.atm)}` : ''} kg
      </Tag>
      {c.axles.map((x, i) => (
        <Dimension
          key={i}
          host="caravan"
          offset={offset}
          x0={0}
          x1={x}
          y={left - i * 480}
          labelX={Math.max(x / 2, x - 1100)}
          label={`Tow ball → ${c.axles.length > 1 ? `axle ${i + 1}` : 'axle'} ${mm(x)}`}
        />
      ))}
    </group>
  );
}
