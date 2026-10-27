import type { CaravanReadings } from '../model/types';
import type { CaravanBaselineSource } from '../model/calc';
import { kg, mm, pct } from '../model/format';
import { axleCentre } from '../model/geometry';
import { loadIndexKg } from '../model/tyres';
import { useStore } from '../state/store';
import { useResult, useSetup } from '../state/result';
import { IssueList, NumField, Section, TextField, Toggle, flagFor } from './fields';

const SOURCE_TEXT: Record<CaravanBaselineSource, string> = {
  measured: 'Baseline: measured',
  partial: 'Baseline: partly estimated',
  spec: 'Baseline: plated tare (not weighed yet)',
};

export function TowingPanel() {
  const setup = useSetup();
  const result = useResult();
  const setPath = useStore((s) => s.setPath);
  const update = useStore((s) => s.update);
  const cv = setup.caravan;
  const base = result.caravan?.baseline;
  const issues = base?.issues ?? [];
  const tyreKg = loadIndexKg(cv.tyre.loadIndex);
  const tandem = cv.axles.length > 1;

  const reading = (key: keyof CaravanReadings, label: string, hint?: string) => (
    <NumField path={`caravanReadings.${key}`} label={label} hint={hint} derived={base?.derived[key] ?? null} flag={flagFor(issues, `caravanReadings.${key}`)} />
  );

  return (
    <div className="tab-body">
      <label className="toggle" style={{ marginBottom: 10, fontWeight: 600 }}>
        <input type="checkbox" checked={setup.towing} onChange={(e) => setPath('towing', e.target.checked)} />
        Towing a caravan
      </label>

      <Section title="Tow bar">
        <div className="fields">
          <NumField
            path="hitch.ballOffset"
            label="Rear axle → ball centre"
            unit="mm"
            nullable={false}
            min={0}
            hint={`Measure along the ground. Front axle → ball: ${mm(setup.ute.wheelbase + setup.hitch.ballOffset)}.`}
          />
          <NumField path="hitch.ballHeight" label="Ball height" unit="mm" nullable={false} min={100} />
          <NumField path="hitch.towbarRating" label="Tow bar rating" hint="From the tow bar plate, if lower." />
          <NumField path="hitch.towbarBallRating" label="Tow bar ball rating" />
        </div>
      </Section>

      {setup.towing && (
        <>
          <Section title="Weight distribution hitch">
            <Toggle path="hitch.wdh.enabled" label="WDH fitted and tensioned" />
            {setup.hitch.wdh.enabled && (
              <>
                <div className="fields" style={{ marginTop: 8 }}>
                  <NumField path="hitch.wdh.restorePct" label="Front axle load restored" unit="%" nullable={false} min={0} hint="50% is a common setting (SAE J2807)." />
                </div>
                <input
                  type="range"
                  min={0}
                  max={100}
                  step={5}
                  value={setup.hitch.wdh.restorePct}
                  onChange={(e) => setPath('hitch.wdh.restorePct', Number(e.target.value))}
                  style={{ width: '100%', accentColor: 'var(--accent)' }}
                  aria-label="Front axle load restored"
                />
                {result.hitch && (
                  <p className="section-note" style={{ marginTop: 6 }}>
                    Moves {kg(result.hitch.wdhMoment / setup.ute.wheelbase)} from the rear to the front axle and{' '}
                    {kg(result.hitch.wdhToCaravan)} onto the caravan axles. The ute now carries {kg(result.hitch.netHitch)} at the hitch.
                  </p>
                )}
              </>
            )}
          </Section>

          <Section title="Caravan readings" extra="unhitched">
            <p className="section-note">Weighbridge (whole caravan off the car) plus a tow ball scale, caravan level. Side loads are optional.</p>
            {base && <div className="source-badge">{SOURCE_TEXT[base.source]}</div>}
            <div className="fields">
              {reading('total', 'Caravan total')}
              {reading('ball', 'Ball weight')}
              {reading('axle', 'Axle group')}
              <div />
              {reading('left', 'Left side')}
              {reading('right', 'Right side')}
            </div>
            {result.caravan && (
              <p className="section-note" style={{ marginTop: 8, marginBottom: 0 }}>
                With items: {kg(result.caravan.mass)}, ball {kg(result.caravan.loads.ball)} ({pct(result.caravan.ballPct)}).
              </p>
            )}
            <IssueList issues={issues} />
          </Section>

          <Section title="Caravan plate">
            <div className="fields">
              <NumField path="caravan.limits.atm" label="ATM" />
              <NumField path="caravan.limits.gtm" label="GTM" />
              <NumField path="caravan.limits.tare" label="Tare" />
              <NumField path="caravan.limits.tareBall" label="Tare ball weight" />
            </div>
            <div style={{ marginTop: 8 }}>
              <Toggle path="caravan.hasBrakes" label="Caravan has brakes" />
            </div>
          </Section>

          <Section title="Axles" extra={tandem ? 'Tandem' : 'Single'}>
            <p className="section-note">Measure along the ground from the tow ball centre to the centre of each wheel hub.</p>
            <div className="fields">
              <label className="field">
                <span className="field-label">Axles</span>
                <span className="field-input">
                  <select
                    value={cv.axles.length}
                    aria-label="Number of axles"
                    onChange={(e) => {
                      const count = Number(e.target.value);
                      // Keep the group centre where it was, so switching alone doesn't move the ball weight.
                      update((s) => {
                        const centre = Math.round(axleCentre(s.caravan));
                        s.caravan.axles = count === 2 ? [centre - 500, centre + 500] : [centre];
                        if (count === 1) s.placeholders = s.placeholders.filter((p) => p !== 'caravan.axles.1');
                      });
                    }}
                  >
                    <option value={1}>Single</option>
                    <option value={2}>Tandem</option>
                  </select>
                </span>
              </label>
              <div />
              <NumField
                path="caravan.axles.0"
                label={tandem ? 'Tow ball → axle 1 (front)' : 'Tow ball → axle'}
                unit="mm"
                nullable={false}
                min={300}
                flag={flagFor(result.issues, 'caravan.axles.0')}
              />
              {tandem && (
                <NumField path="caravan.axles.1" label="Tow ball → axle 2 (rear)" unit="mm" nullable={false} min={300} flag={flagFor(result.issues, 'caravan.axles.1')} />
              )}
            </div>
            {tandem && (
              <p className="section-note" style={{ marginTop: 8, marginBottom: 0 }}>
                Axle spacing {mm(Math.abs(cv.axles[1] - cv.axles[0]))}. The axles share the load equally, so they act as one axle{' '}
                {mm(axleCentre(cv))} behind the tow ball.
              </p>
            )}
          </Section>

          <Section title="Caravan tyres">
            <div className="fields">
              <TextField path="caravan.tyre.size" label="Size" />
              <NumField path="caravan.tyre.loadIndex" label="Load index" unit="LI" hint={tyreKg ? `${kg(tyreKg)} per tyre` : undefined} />
            </div>
          </Section>

          <Section title="Caravan dimensions" open={false}>
            <div className="fields">
              <NumField path="caravan.track" label="Track" unit="mm" nullable={false} min={500} />
              <NumField path="caravan.bodyStart" label="Tow ball → body front" unit="mm" nullable={false} min={300} />
              <NumField path="caravan.bodyLength" label="Body length" unit="mm" nullable={false} min={1000} />
              <NumField path="caravan.bodyWidth" label="Body width" unit="mm" nullable={false} min={1000} />
              <NumField path="caravan.bodyHeight" label="Body height" unit="mm" nullable={false} min={500} />
              <NumField path="caravan.floorHeight" label="Floor height" unit="mm" nullable={false} min={200} />
            </div>
          </Section>
        </>
      )}
    </div>
  );
}
