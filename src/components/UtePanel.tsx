import type { UteReadings } from '../model/types';
import type { UteBaselineSource } from '../model/calc';
import { kg } from '../model/format';
import { loadIndexKg } from '../model/tyres';
import { cannonAlphaVantaDiesel, PAINTS, PRESET_PLACEHOLDERS } from '../model/presets';
import { useStore } from '../state/store';
import { useResult, useSetup } from '../state/result';
import { IssueList, NumField, Section, TextField, flagFor } from './fields';

const SOURCE_TEXT: Record<UteBaselineSource, string> = {
  wheels: 'Baseline: measured per wheel',
  axles: 'Baseline: measured per axle (missing wheels split 50/50)',
  partial: 'Baseline: partly estimated',
  spec: 'Baseline: estimated from the published kerb weight',
};

function TopView() {
  return (
    <svg width="96" height="150" viewBox="0 0 96 150" aria-hidden="true">
      <rect x="14" y="4" width="68" height="142" rx="14" fill="#f1f2f4" stroke="#9aa2ad" strokeWidth="1.5" />
      <path d="M20 40 Q48 30 76 40 L74 60 Q48 54 22 60 Z" fill="#c9d2dc" stroke="#9aa2ad" />
      <rect x="22" y="62" width="52" height="34" rx="4" fill="#e6e9ec" stroke="#b5bcc5" />
      <rect x="22" y="100" width="52" height="40" rx="2" fill="#d4d8dc" stroke="#b5bcc5" />
      <rect x="4" y="18" width="12" height="26" rx="3" fill="#2b2e33" />
      <rect x="80" y="18" width="12" height="26" rx="3" fill="#2b2e33" />
      <rect x="4" y="104" width="12" height="26" rx="3" fill="#2b2e33" />
      <rect x="80" y="104" width="12" height="26" rx="3" fill="#2b2e33" />
      <text x="48" y="16" textAnchor="middle" fontSize="8" fill="#69717d">FRONT</text>
    </svg>
  );
}

export function UtePanel() {
  const setup = useSetup();
  const result = useResult();
  const update = useStore((s) => s.update);
  const setPath = useStore((s) => s.setPath);
  const base = result.ute.baseline;
  const issues = base.issues;
  const tyreKg = loadIndexKg(setup.ute.tyre.loadIndex);

  const reading = (key: keyof UteReadings, label: string) => (
    <div className="wb-cell" style={{ gridArea: key }}>
      <NumField path={`uteReadings.${key}`} label={label} derived={base.derived[key] ?? null} flag={flagFor(issues, `uteReadings.${key}`)} />
    </div>
  );

  return (
    <div className="tab-body">
      <Section title="Weighbridge readings" extra="ute unhitched">
        <p className="section-note">
          Enter what you have: individual wheels, axles and/or the total. Missing values are derived (shown in grey) and every
          redundant reading is cross-checked. Readings already include whatever was on the ute when weighed.
        </p>
        <div className="source-badge">{SOURCE_TEXT[base.source]}</div>
        <div className="wb">
          {reading('fl', 'Front left')}
          {reading('front', 'Front axle')}
          {reading('fr', 'Front right')}
          <div className="body">
            <TopView />
          </div>
          {reading('rl', 'Rear left')}
          {reading('rear', 'Rear axle')}
          {reading('rr', 'Rear right')}
          {reading('total', 'Total')}
        </div>
        <IssueList issues={issues} />
        <div className="btn-row" style={{ marginTop: 10 }}>
          <button
            className="btn"
            onClick={() =>
              update((s) => {
                for (const k of Object.keys(s.uteReadings) as (keyof UteReadings)[]) s.uteReadings[k] = null;
              })
            }
          >
            Clear readings
          </button>
        </div>
      </Section>

      <Section title="Manufacturer limits" extra={setup.ute.name}>
        <div className="fields">
          <NumField path="ute.limits.gvm" label="GVM" />
          <NumField path="ute.limits.gcm" label="GCM" />
          <NumField path="ute.limits.frontAxle" label="Max front axle" />
          <NumField path="ute.limits.rearAxle" label="Max rear axle" />
          <NumField path="ute.limits.kerb" label="Kerb weight" />
          <NumField path="ute.limits.tare" label="Tare weight" />
          <NumField path="ute.limits.payload" label="Max payload" />
          <NumField path="ute.limits.towBallMax" label="Max downball" />
          <NumField path="ute.limits.brakedTow" label="Braked towing" />
          <NumField path="ute.limits.unbrakedTow" label="Unbraked towing" />
        </div>
      </Section>

      <Section title="Tyres">
        <div className="fields">
          <TextField path="ute.tyre.size" label="Size" hint="Sets the wheel size in 3D." />
          <NumField path="ute.tyre.loadIndex" label="Load index" unit="LI" hint={tyreKg ? `${kg(tyreKg)} per tyre` : 'Printed after the size, e.g. 109'} />
        </div>
      </Section>

      <Section title="Paint" extra={PAINTS.find((p) => p.color === setup.ute.paint)?.name ?? 'Custom'}>
        <div className="swatches">
          {PAINTS.map((p) => (
            <button
              key={p.color}
              className={`paint${setup.ute.paint === p.color ? ' on' : ''}`}
              style={{ background: p.color }}
              title={p.name}
              aria-label={p.name}
              onClick={() => setPath('ute.paint', p.color)}
            />
          ))}
          <input type="color" value={setup.ute.paint} onChange={(e) => setPath('ute.paint', e.target.value)} title="Custom colour" aria-label="Custom colour" />
        </div>
      </Section>

      <Section title="Dimensions" open={false}>
        <div className="fields">
          <NumField path="ute.wheelbase" label="Wheelbase" unit="mm" nullable={false} min={1000} />
          <NumField path="ute.frontOverhang" label="Front axle → bumper" unit="mm" nullable={false} min={0} />
          <NumField path="ute.trackFront" label="Track front" unit="mm" nullable={false} min={500} />
          <NumField path="ute.trackRear" label="Track rear" unit="mm" nullable={false} min={500} />
          <NumField path="ute.overallLength" label="Overall length" unit="mm" nullable={false} min={2000} />
          <NumField path="ute.overallWidth" label="Overall width" unit="mm" nullable={false} min={1000} />
          <NumField path="ute.overallHeight" label="Overall height" unit="mm" nullable={false} min={1000} />
          <NumField path="ute.kerbFrontPct" label="Kerb weight on front" unit="%" nullable={false} min={1} hint="Only used before you weigh." />
          <NumField path="ute.tub.length" label="Tub length (inside)" unit="mm" nullable={false} min={300} />
          <NumField path="ute.tub.width" label="Tub width (inside)" unit="mm" nullable={false} min={300} />
          <NumField path="ute.tub.depth" label="Tub depth" unit="mm" nullable={false} min={100} />
          <NumField path="ute.tub.floorHeight" label="Tub floor height" unit="mm" nullable={false} min={300} />
        </div>
      </Section>

      <div className="btn-row">
        <button
          className="btn"
          onClick={() => {
            if (!confirm('Reset the vehicle dimensions, tyres and limits to the Cannon Alpha Vanta 3.0L diesel preset? Readings and items are kept.')) return;
            update((s) => {
              s.ute = cannonAlphaVantaDiesel();
              s.placeholders = [...new Set([...s.placeholders.filter((p) => !p.startsWith('ute.')), ...PRESET_PLACEHOLDERS.filter((p) => p.startsWith('ute.'))])];
            });
          }}
        >
          Reset vehicle to preset
        </button>
      </div>
    </div>
  );
}
