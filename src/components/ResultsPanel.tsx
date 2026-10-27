import type { Check, CheckGroup, CheckStatus } from '../model/calc';
import { WHEEL_IDS, overallStatus } from '../model/calc';
import { kg, num, pct, signedKg } from '../model/format';
import { useResult, useSetup } from '../state/result';
import { IssueList, NumField, Section } from './fields';

export const STATUS_TEXT: Record<CheckStatus, string> = {
  ok: 'OK',
  near: 'Near',
  over: 'Over',
  unset: 'No limit',
  warn: 'Check',
};

function fmtValue(c: Check, v: number) {
  return c.unit === '%' ? pct(v) : num(v);
}

export function CheckBar({ c }: { c: Check }) {
  if (c.limit == null || !(c.limit > 0)) return null;
  if (c.unit === '%' && c.min != null) {
    // Advisory band: show the recommended range on a 0–20% scale.
    const scale = 20;
    const at = (v: number) => `${Math.max(0, Math.min(100, (v / scale) * 100))}%`;
    return (
      <div className="bar">
        <div className="bar-band" style={{ left: at(c.min), width: `calc(${at(c.limit)} - ${at(c.min)})` }} />
        <div className="bar-marker" style={{ left: at(c.value), width: 3, background: c.status === 'ok' ? 'var(--ok)' : 'var(--near)', opacity: 1 }} />
      </div>
    );
  }
  const scale = c.limit * 1.2;
  const frac = Math.max(0, Math.min(1, c.value / scale));
  const color = c.status === 'over' ? 'var(--over)' : c.status === 'near' || c.status === 'warn' ? 'var(--near)' : 'var(--ok)';
  return (
    <div className="bar">
      <div className="bar-fill" style={{ width: `${frac * 100}%`, background: color }} />
      <div className="bar-marker" style={{ left: `${(1 / 1.2) * 100}%` }} />
    </div>
  );
}

function CheckRow({ c }: { c: Check }) {
  return (
    <div className="check">
      <div className="check-head">
        <span className="check-label">{c.label}</span>
        <span className="check-value">
          {fmtValue(c, c.value)}
          {c.limit != null && c.limit > 0 && (
            <span className="lim">
              {' '}
              / {c.min != null ? `${fmtValue(c, c.min)}–` : ''}
              {fmtValue(c, c.limit)}
            </span>
          )}
          {c.unit === 'kg' ? ' kg' : ''}
        </span>
        <span className={`pill pill-${c.status}`}>{STATUS_TEXT[c.status]}</span>
      </div>
      <CheckBar c={c} />
      {(c.detail || (c.limit != null && c.limit > 0 && c.unit === 'kg' && !c.advisory)) && (
        <div className="check-detail">
          {c.limit != null && c.limit > 0 && c.unit === 'kg' && !c.advisory && (
            <>{c.value > c.limit ? `${kg(c.value - c.limit)} over. ` : `${kg(c.limit - c.value)} spare. `}</>
          )}
          {c.detail}
        </div>
      )}
    </div>
  );
}

const GROUPS: CheckGroup[] = ['Vehicle', 'Tyres', 'Towing', 'Caravan'];

export function Headline() {
  const result = useResult();
  const status = overallStatus(result);
  const over = result.checks.filter((c) => c.status === 'over');
  const warn = result.checks.filter((c) => c.status === 'warn' || c.status === 'near');
  const unset = result.checks.filter((c) => c.status === 'unset');
  const dataWarnings = result.issues.filter((i) => i.level !== 'info').length;
  const dataText = dataWarnings ? `${dataWarnings} reading${dataWarnings === 1 ? '' : 's'} to re-check (see Data checks).` : '';
  const icon = status === 'ok' ? '✓' : status === 'unset' ? '?' : '!';
  const big =
    over.length > 0
      ? `${over.length} limit${over.length === 1 ? '' : 's'} exceeded`
      : warn.length > 0
        ? 'Within limits, with warnings'
        : dataWarnings > 0
          ? 'Within limits, but check the readings'
          : unset.length > 0
            ? 'Within the limits that are set'
            : 'All within limits';
  const sub = [
    over.length > 0 ? over.map((c) => c.label).join(', ') : warn.length > 0 ? warn.map((c) => c.label).join(', ') : '',
    dataText,
    !over.length && !warn.length && !dataWarnings
      ? unset.length > 0
        ? `${unset.length} check${unset.length === 1 ? ' has' : 's have'} no limit entered.`
        : 'Every rated limit has spare capacity.'
      : '',
  ]
    .filter(Boolean)
    .join(' ');
  return (
    <div className={`headline headline-${status}`}>
      <div className={`status-icon bg-${status}`}>{icon}</div>
      <div>
        <div className="big">{big}</div>
        <div className="sub">{sub}</div>
      </div>
    </div>
  );
}

function LoadTable() {
  const setup = useSetup();
  const r = useResult();
  const u = r.ute;
  const towing = Boolean(r.caravan);
  const rows: { label: string; base: number; items: number; hitch: number; total: number }[] = WHEEL_IDS.map((w) => ({
    label: w.toUpperCase(),
    base: u.baseline.wheels[w],
    items: u.items[w],
    hitch: u.hitch[w],
    total: u.total[w],
  }));
  const sumRows = (ids: number[]) =>
    ids.reduce(
      (acc, i) => ({ base: acc.base + rows[i].base, items: acc.items + rows[i].items, hitch: acc.hitch + rows[i].hitch, total: acc.total + rows[i].total }),
      { base: 0, items: 0, hitch: 0, total: 0 },
    );
  const front = sumRows([0, 1]);
  const rear = sumRows([2, 3]);
  const all = sumRows([0, 1, 2, 3]);
  return (
    <>
      <table className="loads">
        <thead>
          <tr>
            <th>Ute (kg)</th>
            <th>Baseline</th>
            <th>Items</th>
            {towing && <th>Hitch</th>}
            <th>Total</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.label}>
              <td>{row.label}</td>
              <td>{num(row.base)}</td>
              <td>{signedKg(row.items).replace(' kg', '')}</td>
              {towing && <td>{signedKg(row.hitch).replace(' kg', '')}</td>}
              <td>{num(row.total)}</td>
            </tr>
          ))}
          {[
            ['Front axle', front],
            ['Rear axle', rear],
            ['Gross', all],
          ].map(([label, v]) => {
            const s = v as typeof all;
            return (
              <tr key={label as string} className="total">
                <td>{label as string}</td>
                <td>{num(s.base)}</td>
                <td>{signedKg(s.items).replace(' kg', '')}</td>
                {towing && <td>{signedKg(s.hitch).replace(' kg', '')}</td>}
                <td>{num(s.total)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
      {r.caravan && (
        <table className="loads" style={{ marginTop: 10 }}>
          <thead>
            <tr>
              <th>Caravan (kg)</th>
              <th>Baseline</th>
              <th>Items</th>
              <th>WDH</th>
              <th>Total</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>Ball</td>
              <td>{num(r.caravan.baseline.loads.ball)}</td>
              <td>{signedKg(r.caravan.items.ball).replace(' kg', '')}</td>
              <td>–</td>
              <td>{num(r.caravan.loads.ball)}</td>
            </tr>
            <tr>
              <td>Left side</td>
              <td>{num(r.caravan.baseline.loads.left)}</td>
              <td>{signedKg(r.caravan.items.left).replace(' kg', '')}</td>
              <td>{signedKg(r.caravan.axleLeft - r.caravan.loads.left).replace(' kg', '')}</td>
              <td>{num(r.caravan.axleLeft)}</td>
            </tr>
            <tr>
              <td>Right side</td>
              <td>{num(r.caravan.baseline.loads.right)}</td>
              <td>{signedKg(r.caravan.items.right).replace(' kg', '')}</td>
              <td>{signedKg(r.caravan.axleRight - r.caravan.loads.right).replace(' kg', '')}</td>
              <td>{num(r.caravan.axleRight)}</td>
            </tr>
            {r.caravan.axleLoads.length > 1 &&
              r.caravan.axleLoads.map((load, i) => {
                const share = (x: number) => signedKg(x / r.caravan!.axleLoads.length).replace(' kg', '');
                return (
                  <tr key={i}>
                    <td>{i === 0 ? 'Front axle' : 'Rear axle'}</td>
                    <td>{num(r.caravan!.baseline.axles[i])}</td>
                    <td>{share(r.caravan!.items.left + r.caravan!.items.right)}</td>
                    <td>{share(r.hitch!.wdhToCaravan)}</td>
                    <td>{num(load)}</td>
                  </tr>
                );
              })}
            <tr className="total">
              <td>Caravan mass</td>
              <td>{num(r.caravan.baseline.loads.ball + r.caravan.baseline.loads.left + r.caravan.baseline.loads.right)}</td>
              <td>{signedKg(r.caravan.items.ball + r.caravan.items.left + r.caravan.items.right).replace(' kg', '')}</td>
              <td>–</td>
              <td>{num(r.caravan.mass)}</td>
            </tr>
          </tbody>
        </table>
      )}
      <p className="section-note" style={{ marginTop: 8, marginBottom: 0 }}>
        {setup.towing
          ? 'Hitch: ball weight levered about the rear axle (it lifts the front), plus any WDH transfer.'
          : 'Items: what-if items minus items already included in the readings, at their weighed positions.'}
      </p>
    </>
  );
}

function Headroom() {
  const r = useResult();
  const setup = useSetup();
  const h = r.headroom;
  const stat = (k: string, v: number | null, s?: string) => (
    <div className="stat">
      <div className="k">{k}</div>
      <div className="v" style={{ color: v != null && v < 0 ? 'var(--over)' : undefined }}>
        {v == null ? '–' : kg(v)}
      </div>
      {s && <div className="s">{s}</div>}
    </div>
  );
  return (
    <div className="stat-grid">
      {stat('Spare GVM', h.gvm)}
      {stat('Spare front axle', h.frontAxle)}
      {stat('Spare rear axle', h.rearAxle)}
      {setup.towing ? stat('Spare GCM', h.gcm) : stat('Ute mass now', r.ute.gross)}
      <div style={{ gridColumn: '1 / -1' }}>
        {stat('Heaviest caravan you could tow as the ute is loaded', h.maxCaravan, h.maxCaravanBy ? `Limited by ${h.maxCaravanBy}.` : undefined)}
      </div>
    </div>
  );
}

export function ResultsPanel() {
  const result = useResult();
  return (
    <div className="tab-body">
      <Headline />
      {GROUPS.map((g) => {
        const checks = result.checks.filter((c) => c.group === g);
        if (!checks.length) return null;
        return (
          <div key={g}>
            <div className="check-group-title">{g}</div>
            {checks.map((c) => (
              <CheckRow key={c.id} c={c} />
            ))}
          </div>
        );
      })}

      {result.issues.length > 0 && (
        <>
          <div className="check-group-title">Data checks</div>
          <IssueList issues={result.issues} />
        </>
      )}

      <div className="check-group-title">Load breakdown</div>
      <LoadTable />

      <div className="check-group-title">Headroom</div>
      <Headroom />

      <div style={{ height: 14 }} />
      <Section title="Check settings" open={false}>
        <div className="fields">
          <NumField path="settings.tolAbs" label="Reading tolerance" nullable={false} min={0} />
          <NumField path="settings.tolPct" label="…or relative" unit="%" nullable={false} min={0} />
          <NumField path="settings.nearPct" label="Warn from" unit="% of limit" nullable={false} min={50} />
          <NumField path="settings.frontUnloadPct" label="Front axle unloading warning" unit="%" nullable={false} min={0} />
          <NumField path="settings.ballPctMin" label="Ball weight min" unit="%" nullable={false} min={0} />
          <NumField path="settings.ballPctMax" label="Ball weight max" unit="%" nullable={false} min={0} />
        </div>
      </Section>
    </div>
  );
}
