import { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { WHEEL_IDS, overallStatus } from '../model/calc';
import { kg, mm, num, pct } from '../model/format';
import { loadIndexKg } from '../model/tyres';
import { useResult, useSetup } from '../state/result';
import { useUi } from '../state/ui';
import { STATUS_TEXT } from './ResultsPanel';
import { effectText } from './ItemsPanel';

const SOURCE: Record<string, string> = {
  wheels: 'measured per wheel',
  axles: 'measured per axle',
  partial: 'partly estimated',
  spec: 'estimated (not weighed)',
  measured: 'measured',
};

let host: HTMLDivElement | null = null;

/** Print-only summary. Rendered while a snapshot is pending, then removed after printing. */
export function Report() {
  const snapshot = useUi((s) => s.snapshot);
  const setup = useSetup();
  const r = useResult();

  useEffect(() => {
    const done = () => useUi.getState().setSnapshot(null);
    window.addEventListener('afterprint', done);
    return () => window.removeEventListener('afterprint', done);
  }, []);

  if (snapshot === null) return null;
  if (!host) {
    host = document.createElement('div');
    host.className = 'print-root';
    document.body.appendChild(host);
  }
  const u = setup.ute;
  const status = overallStatus(r);
  const r2 = r.ute.total;

  return createPortal(
    <div>
      <h1>{setup.name}</h1>
      <div className="meta">
        {u.name} · {new Date().toLocaleString('en-AU')} · Overall: {STATUS_TEXT[status]}
        {setup.towing && ` · towing ${setup.caravan.name}`}
      </div>
      {snapshot && <img src={snapshot} alt="3D view of the loaded vehicle" />}

      <h2>Checks</h2>
      <table>
        <thead>
          <tr>
            <th>Check</th>
            <th className="r">Value</th>
            <th className="r">Limit</th>
            <th>Status</th>
            <th>Note</th>
          </tr>
        </thead>
        <tbody>
          {r.checks.map((c) => (
            <tr key={c.id}>
              <td>{c.label}</td>
              <td className="r">{c.unit === '%' ? pct(c.value) : kg(c.value)}</td>
              <td className="r">
                {c.limit == null ? '–' : c.unit === '%' ? `${c.min != null ? `${pct(c.min)}–` : ''}${pct(c.limit)}` : kg(c.limit)}
              </td>
              <td className={`st-${c.status}`}>{STATUS_TEXT[c.status]}</td>
              <td>{c.detail}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="cols">
        <div>
          <h2>Ute wheel loads</h2>
          <table>
            <thead>
              <tr>
                <th>Wheel</th>
                <th className="r">Baseline</th>
                <th className="r">Now</th>
                <th className="r">Tyre</th>
              </tr>
            </thead>
            <tbody>
              {WHEEL_IDS.map((w) => (
                <tr key={w}>
                  <td>{w.toUpperCase()}</td>
                  <td className="r">{kg(r.ute.baseline.wheels[w])}</td>
                  <td className="r">{kg(r2[w])}</td>
                  <td className="r">{loadIndexKg(u.tyre.loadIndex) ? kg(loadIndexKg(u.tyre.loadIndex)!) : '–'}</td>
                </tr>
              ))}
              <tr>
                <td>Front / rear axle</td>
                <td />
                <td className="r">
                  {num(r.ute.front)} / {num(r.ute.rear)} kg
                </td>
                <td />
              </tr>
            </tbody>
          </table>
          <p>Baseline {SOURCE[r.ute.baseline.source]}.</p>
        </div>
        <div>
          <h2>Vehicle</h2>
          <table>
            <tbody>
              <tr>
                <td>Wheelbase / track</td>
                <td className="r">
                  {mm(u.wheelbase)} / {mm(u.trackFront)}
                </td>
              </tr>
              <tr>
                <td>Rear axle → tow ball</td>
                <td className="r">{mm(setup.hitch.ballOffset)}</td>
              </tr>
              <tr>
                <td>Tyres</td>
                <td className="r">
                  {u.tyre.size} LI {u.tyre.loadIndex ?? '–'}
                </td>
              </tr>
              {r.caravan && r.hitch && (
                <>
                  <tr>
                    <td>Caravan mass / ball</td>
                    <td className="r">
                      {kg(r.caravan.mass)} / {kg(r.hitch.ball)} ({pct(r.caravan.ballPct)})
                    </td>
                  </tr>
                  <tr>
                    <td>Caravan axle group</td>
                    <td className="r">{kg(r.caravan.axle)}</td>
                  </tr>
                  <tr>
                    <td>Tow ball → caravan {setup.caravan.axles.length > 1 ? 'axles' : 'axle'}</td>
                    <td className="r">{setup.caravan.axles.map((x) => num(x)).join(' / ')} mm</td>
                  </tr>
                  <tr>
                    <td>WDH</td>
                    <td className="r">{setup.hitch.wdh.enabled ? `${pct(setup.hitch.wdh.restorePct)} front restore` : 'none'}</td>
                  </tr>
                  <tr>
                    <td>Caravan baseline</td>
                    <td className="r">{SOURCE[r.caravan.baseline.source]}</td>
                  </tr>
                </>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <h2>Items</h2>
      <table>
        <thead>
          <tr>
            <th>Item</th>
            <th>On</th>
            <th className="r">Mass</th>
            <th className="r">Position (x / y / z)</th>
            <th>State</th>
            <th>Effect</th>
          </tr>
        </thead>
        <tbody>
          {setup.items.map((it) => (
            <tr key={it.id}>
              <td>{it.name}</td>
              <td>{it.host}</td>
              <td className="r">{kg(it.mass)}</td>
              <td className="r">
                {num(it.pos.x)} / {num(it.pos.y)} / {num(it.pos.z)}
              </td>
              <td>{[it.enabled ? 'included' : 'left out', it.measured ? 'weighed' : 'added'].join(', ')}</td>
              <td>{effectText(it, r.itemEffects[it.id])}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {r.issues.length > 0 && (
        <>
          <h2>Data checks</h2>
          <ul>
            {r.issues.map((i, k) => (
              <li key={k}>{i.message}</li>
            ))}
          </ul>
        </>
      )}
      <p className="meta">
        Static estimate from weighbridge readings plus planned items. Always confirm on a weighbridge before travelling. Positions in mm:
        x behind the front axle (ute) or coupling (caravan), y right of centre, z height.
      </p>
    </div>,
    host,
  );
}
