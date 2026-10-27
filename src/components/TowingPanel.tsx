import type { CaravanReadings, TrailerKind } from '../model/types';
import type { CaravanBaselineSource } from '../model/calc';
import { kg, mm, pct } from '../model/format';
import { axleCentre } from '../model/geometry';
import { loadIndexKg } from '../model/tyres';
import { applyTrailerKind } from '../model/presets';
import { TRAILER_KINDS, trailerInfo, trailerName } from '../model/trailers';
import { useUi } from '../state/ui';
import { useStore } from '../state/store';
import { useResult, useSetup } from '../state/result';
import { IssueList, NumField, ReadField, Section, TextField, Toggle, flagFor } from './fields';

const SOURCE_TEXT: Record<CaravanBaselineSource, string> = {
  measured: 'Baseline: measured',
  partial: 'Baseline: partly estimated',
  spec: 'Baseline: plated tare (not weighed yet)',
};

/** Small side-on silhouettes for the trailer type picker. */
function KindIcon({ kind }: { kind: TrailerKind }) {
  const wheel = (cx: number) => <circle cx={cx} cy="23" r="4" fill="currentColor" />;
  const bar = <path d="M2 19h10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />;
  return (
    <svg width="44" height="28" viewBox="0 0 44 28" aria-hidden="true">
      {bar}
      {kind === 'caravan' && <rect x="11" y="4" width="30" height="16" rx="4" fill="currentColor" opacity="0.85" />}
      {kind === 'enclosed' && <rect x="12" y="6" width="26" height="14" rx="1.5" fill="currentColor" opacity="0.85" />}
      {kind === 'open' && <path d="M12 12h26v8H12z M12 12v-2 M38 12v-2" fill="currentColor" stroke="currentColor" strokeWidth="1.5" opacity="0.85" />}
      {kind === 'boat' && (
        <>
          <path d="M10 12h24l6-4v4l-3 6H13z" fill="currentColor" opacity="0.85" />
          <path d="M12 19h26" stroke="currentColor" strokeWidth="1.5" />
        </>
      )}
      {kind === 'caravan' || kind === 'enclosed' ? (
        <>
          {wheel(24)}
          {wheel(31)}
        </>
      ) : (
        wheel(kind === 'boat' ? 30 : 26)
      )}
    </svg>
  );
}

/** Field labels for the trailer body, which means something different on a boat trailer. */
function bodyLabels(kind: TrailerKind) {
  if (kind === 'boat') {
    return { start: 'Tow ball → winch post', length: 'Bunk frame length', width: 'Bunk frame width', height: null, floor: 'Bunk height' };
  }
  return {
    start: 'Tow ball → body front',
    length: 'Body length',
    width: 'Body width',
    height: kind === 'open' ? 'Side height' : kind === 'enclosed' ? 'Body height (inside)' : 'Body height',
    floor: 'Floor height',
  };
}

export function TowingPanel() {
  const setup = useSetup();
  const result = useResult();
  const setPath = useStore((s) => s.setPath);
  const update = useStore((s) => s.update);
  const cv = setup.caravan;
  const base = result.caravan?.baseline;
  const issues = base?.issues ?? [];
  const indexKg = loadIndexKg(cv.tyre.loadIndex);
  const { atm, tare } = cv.limits;
  const loadCapacity = atm != null && tare != null ? atm - tare : null;
  const atmOverTow = result.checks.find((c) => c.id === 'atmVsTow' && c.status === 'over');
  const tandem = cv.axles.length > 1;
  const T = trailerName(cv.kind);
  const Tc = trailerName(cv.kind, true);
  const labels = bodyLabels(cv.kind);

  const switchKind = (kind: TrailerKind) => {
    if (kind === cv.kind) return;
    const info = trailerInfo(kind);
    const onTrailer = setup.items.filter((i) => i.host === 'caravan' || i.measured?.host === 'caravan').length;
    const removes = onTrailer ? ` and removes the ${onTrailer} item${onTrailer === 1 ? '' : 's'} on the current ${T}` : '';
    if (!confirm(`Switch to ${info.label.toLowerCase()}? This loads typical values for it (marked as placeholders), clears the ${T} readings${removes}. You can undo it.`)) return;
    update((s) => applyTrailerKind(s, kind));
    useUi.getState().select(null);
    useUi.getState().setView('iso');
  };

  const reading = (key: keyof CaravanReadings, label: string, hint?: string) => (
    <NumField path={`caravanReadings.${key}`} label={label} hint={hint} derived={base?.derived[key] ?? null} flag={flagFor(issues, `caravanReadings.${key}`)} />
  );

  return (
    <div className="tab-body">
      <label className="toggle" style={{ marginBottom: 8, fontWeight: 600 }}>
        <input type="checkbox" checked={setup.towing} onChange={(e) => setPath('towing', e.target.checked)} />
        Towing
      </label>
      {setup.towing && (
        <div className="kinds" role="radiogroup" aria-label="Trailer type">
          {TRAILER_KINDS.map((k) => (
            <button
              key={k.kind}
              role="radio"
              aria-checked={cv.kind === k.kind}
              className={`kind${cv.kind === k.kind ? ' on' : ''}`}
              title={k.description}
              onClick={() => switchKind(k.kind)}
            >
              <KindIcon kind={k.kind} />
              <span>{k.label}</span>
            </button>
          ))}
        </div>
      )}

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
                    {kg(result.hitch.wdhToCaravan)} onto the {T} axles. The ute now carries {kg(result.hitch.netHitch)} at the hitch.
                  </p>
                )}
              </>
            )}
          </Section>

          <Section title={`${Tc} readings`} extra="unhitched">
            <p className="section-note">
              Weighbridge (whole {T} off the car) plus a tow ball scale, {T} level. Side loads are optional.
              {cv.kind === 'boat' &&
                ' If you weigh with the boat on, mark the boat, motor and fuel as weighed in the Items tab so they are not counted twice.'}
            </p>
            {base && <div className="source-badge">{SOURCE_TEXT[base.source]}</div>}
            <div className="fields">
              {reading('total', `${Tc} total`)}
              {reading('ball', 'Ball weight')}
              {reading('axle', 'Axle group')}
              <div />
              {tandem && reading('axleFront', 'Front axle')}
              {tandem && reading('axleRear', 'Rear axle')}
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

          <Section title={`${Tc} compliance plate`}>
            <p className="section-note">Laid out like the ratings and masses on the plate.</p>
            <div className="fields">
              <NumField path="caravan.limits.tare" label="Tare mass" />
              <NumField path="caravan.limits.tareBall" label="Coupling load at tare mass" />
              <NumField path="caravan.limits.gtm" label="GTM" />
              <ReadField label="Load capacity" value={loadCapacity} hint="ATM minus tare mass." />
              <NumField
                path="caravan.limits.atm"
                label="ATM"
                flag={atmOverTow ? 'error' : null}
                hint={atmOverTow ? `More than the ute may tow (${kg(atmOverTow.limit!)}).` : undefined}
              />
              <NumField path="caravan.limits.tgalr" label="TGALR" hint={`Trailer gross axle load rating: what the axle group may carry${tandem ? ', shared by both axles' : ''}.`} />
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

          <Section title={`${Tc} tyres`}>
            <div className="fields">
              <TextField path="caravan.tyre.size" label="Tyre size" />
              <NumField path="caravan.tyre.loadKg" label="Tyre load rating" hint="Per tyre, from the plate. Overrides the load index." />
              <NumField
                path="caravan.tyre.loadIndex"
                label="Load index"
                unit="LI"
                hint={indexKg ? `${kg(indexKg)} per tyre${cv.tyre.loadKg != null ? ', not used while a load rating is set' : ''}` : 'Printed after the tyre size, e.g. 121'}
              />
            </div>
          </Section>

          <Section title={`${Tc} dimensions`} open={false}>
            <div className="fields">
              <NumField path="caravan.track" label="Track" unit="mm" nullable={false} min={500} />
              <NumField path="caravan.bodyStart" label={labels.start} unit="mm" nullable={false} min={300} />
              <NumField path="caravan.bodyLength" label={labels.length} unit="mm" nullable={false} min={1000} />
              <NumField path="caravan.bodyWidth" label={labels.width} unit="mm" nullable={false} min={800} />
              {labels.height && <NumField path="caravan.bodyHeight" label={labels.height} unit="mm" nullable={false} min={100} />}
              <NumField path="caravan.floorHeight" label={labels.floor} unit="mm" nullable={false} min={200} />
            </div>
          </Section>
        </>
      )}
    </div>
  );
}
