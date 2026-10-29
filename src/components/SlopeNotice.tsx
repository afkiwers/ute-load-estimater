import { mm } from '../model/format';
import { trailerName } from '../model/trailers';
import { useResult, useSetup } from '../state/result';
import { useUi } from '../state/ui';
import { Modal } from './Modal';

const COG_UNKNOWN = 'The centre of mass heights are not known, only assumed.';

/** Pops up each time the vehicle leaves level ground: slope results rest on assumed centre of mass heights. */
export function SlopeNotice() {
  const open = useUi((s) => s.slopeNotice);
  const close = useUi((s) => s.closeSlopeNotice);
  const setSlope = useUi((s) => s.setSlope);
  const setup = useSetup();
  const { slope } = useResult();
  if (!open) return null;
  const T = trailerName(setup.caravan.kind);
  return (
    <Modal
      title="Slope results are illustrative only"
      onClose={close}
      footer={
        <>
          <button
            className="btn"
            onClick={() => {
              setSlope(0);
              close();
            }}
          >
            Back to level ground
          </button>
          <button className="btn primary" autoFocus onClick={close}>
            I understand, show me
          </button>
        </>
      }
    >
      <div className="slope-notice">
        <p className="slope-notice-lead">
          <strong>{COG_UNKNOWN}</strong> How much load moves between the axles on a slope depends mostly on how high the weight sits,
          and this app cannot know that for your {setup.towing ? `vehicle and ${T}` : 'vehicle'}.
        </p>
        <p>The slope view uses typical guesses:</p>
        <ul>
          <li>
            Vehicle centre of mass <b>{mm(slope.uteCog)}</b> above the ground (40% of its overall height)
          </li>
          {slope.trailerCog != null && (
            <li>
              {trailerName(setup.caravan.kind, true)} centre of mass <b>{mm(slope.trailerCog)}</b> above the ground (its floor plus a fifth of
              its body height)
            </li>
          )}
          {setup.towing && <li>The {T}'s brakes off, at a steady speed</li>}
        </ul>
        <p>
          The real heights can differ a lot, so the real loads can be noticeably higher or lower than shown.{' '}
          <strong>Use it to see which way load shifts and roughly how much, not to decide whether you are within a limit on a hill.</strong>
        </p>
      </div>
    </Modal>
  );
}

/** Stays over the 3D view while it stands on a slope. */
export function SlopeBanner() {
  const slope = useUi((s) => s.slope);
  if (slope === 0) return null;
  return (
    <div className="slope-banner" role="status">
      <strong>Illustrative only:</strong> {COG_UNKNOWN}
    </div>
  );
}
