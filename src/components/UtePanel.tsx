import type { UteReadings } from '../model/types';
import type { UteBaselineSource } from '../model/calc';
import { kg } from '../model/format';
import { loadIndexKg, tyreDiameter } from '../model/tyres';
import { applyVehicle, PAINTS } from '../model/presets';
import { VEHICLE_GROUPS, VEHICLES, vehicleModel } from '../model/vehicles';
import { useStore } from '../state/store';
import { useResult, useSetup } from '../state/result';
import { IssueList, NumField, Section, TextField, Toggle, flagFor } from './fields';

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
      <Section title="Vehicle">
        <label className="field">
          <span className="field-label">Model</span>
          <span className="field-input">
            <select value={setup.ute.model} onChange={(e) => update((s) => applyVehicle(s, e.target.value))}>
              {VEHICLE_GROUPS.map((group) => (
                <optgroup key={group} label={group}>
                  {VEHICLES.filter((v) => v.group === group).map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.label}
                    </option>
                  ))}
                </optgroup>
              ))}
            </select>
          </span>
          <span className="field-hint">
            Loads its published limits, tyres and dimensions. Readings, items and paint stay. Values marked placeholder are typical: check them
            against your placard.
          </span>
        </label>
      </Section>

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

      <Section title="Manufacturer limits">
        <div className="fields">
          <NumField path="ute.limits.gvm" label="GVM" />
          <NumField path="ute.limits.gcm" label="GCM" />
          <NumField path="ute.limits.frontAxle" label="Max front axle" />
          <NumField path="ute.limits.rearAxle" label="Max rear axle" />
          <NumField path="ute.limits.kerb" label="Kerb weight" />
          <NumField path="ute.limits.tare" label="Tare weight" hint="Checks the weighbridge total isn't too light." />
          <NumField path="ute.limits.payload" label="Max payload" />
          <NumField path="ute.limits.towBallMax" label="Max downball" />
          <NumField path="ute.limits.brakedTow" label="Braked towing" />
          <NumField path="ute.limits.unbrakedTow" label="Unbraked towing" />
        </div>
      </Section>

      <Section title="Tyres">
        <div className="fields">
          <TextField
            path="ute.tyre.size"
            label="Size"
            hint={tyreDiameter(setup.ute.tyre.size) ? 'Sets the wheel size in 3D.' : 'Not recognised, so the 3D wheels use a typical size. Write it like 265/60R18.'}
          />
          <NumField path="ute.tyre.loadIndex" label="Load index" unit="LI" hint={tyreKg ? `${kg(tyreKg)} per tyre` : 'Printed after the size, e.g. 109'} />
        </div>
      </Section>

      <Section title="Appearance" extra={PAINTS.find((p) => p.color === setup.ute.paint)?.name ?? 'Custom'}>
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
        <div style={{ marginTop: 10 }}>
          <Toggle path="ute.sunroof" label="Panoramic sunroof" />
        </div>
      </Section>

      <Section title="Dimensions" open={false}>
        <p className="section-note">
          Wheelbase and track set how loads split between the axles and wheels. The other sizes shape the 3D model and where items sit.
        </p>
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
            const model = vehicleModel(setup.ute.model);
            if (!confirm(`Reset the dimensions, tyres and limits to the ${model.label} figures? Readings, items and paint are kept.`)) return;
            update((s) => applyVehicle(s, model.id));
          }}
        >
          Reset to the model's figures
        </button>
      </div>
    </div>
  );
}
