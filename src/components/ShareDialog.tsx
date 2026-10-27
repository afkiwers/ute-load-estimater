import { useEffect, useState } from 'react';
import type { Setup } from '../model/types';
import { trailerName } from '../model/trailers';
import { encodeSetup, shareUrl } from '../share';
import { useSetup } from '../state/result';
import { useStore } from '../state/store';
import { useUi } from '../state/ui';
import { CopyIcon, ShareIcon, copy } from './clipboard';
import { Modal } from './Modal';

/** What a setup holds, e.g. "Cannon Alpha Vanta 3.0L diesel towing a caravan, weighed, 4 items". */
export function setupSummary(s: Setup): string {
  const parts = [s.ute.name.replace(/^(GWM|Isuzu) /, '') + (s.towing ? ` towing a ${trailerName(s.caravan.kind)}` : '')];
  if (Object.values(s.uteReadings).some((v) => v != null)) parts.push('weighed');
  parts.push(`${s.items.length} item${s.items.length === 1 ? '' : 's'}`);
  return parts.join(', ');
}

export function ShareDialog({ onClose }: { onClose: () => void }) {
  const setup = useSetup();
  const [url, setUrl] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    let live = true;
    encodeSetup(setup).then(
      (payload) => live && setUrl(shareUrl(payload, location)),
      () => live && setFailed(true),
    );
    return () => {
      live = false;
    };
  }, [setup]);

  // The phone's own share sheet (Messages, WhatsApp, email, AirDrop); copying the link where there is none.
  const canShare = typeof navigator.share === 'function';
  const share = async () => {
    if (!url) return;
    try {
      await navigator.share({ title: `Vehicle load setup: ${setup.name}`, text: `${setup.name}: ${setupSummary(setup)}.`, url });
    } catch (e) {
      if ((e as Error).name !== 'AbortError') await copy(url, 'Link');
    }
  };

  return (
    <Modal
      title="Share this setup"
      onClose={onClose}
      footer={
        <>
          <button className="btn btn-outline" disabled={!url} onClick={() => url && copy(url, 'Link')}>
            <CopyIcon /> Copy link
          </button>
          {canShare ? (
            <button className="btn primary btn-with-icon" disabled={!url} onClick={share}>
              <ShareIcon /> Share…
            </button>
          ) : (
            <button className="btn primary" onClick={onClose}>
              Done
            </button>
          )}
        </>
      }
    >
      <p className="share-text">
        Anyone you send the link to opens their own copy of <strong>{setup.name}</strong>: {setupSummary(setup)}, with its readings, limits and
        trailer. Changes they make don't affect yours.
      </p>
      {failed ? (
        <p className="field-problem">This browser can't make the link. Use Export instead and send the file.</p>
      ) : (
        <input className="share-link" readOnly value={url ?? 'Making the link…'} onFocus={(e) => e.target.select()} aria-label="Share link" />
      )}
      <p className="about-note">The setup travels inside the link itself; nothing is uploaded. The link opens the online app.</p>
    </Modal>
  );
}

/** Offers to add a setup someone shared as a link. */
export function SharedSetupDialog({ setup, onClose }: { setup: Setup; onClose: () => void }) {
  const importSetups = useStore((s) => s.importSetups);
  return (
    <Modal
      title="Shared setup"
      onClose={onClose}
      footer={
        <>
          <button className="btn" onClick={onClose}>
            Not now
          </button>
          <button
            className="btn primary"
            onClick={() => {
              importSetups([setup]);
              useUi.getState().showToast(`Added “${setup.name}” to your setups.`);
              onClose();
            }}
          >
            Add to my setups
          </button>
        </>
      }
    >
      <p className="share-text">
        This link holds <strong>{setup.name}</strong>: {setupSummary(setup)}.
      </p>
      <p className="about-note">It's added as a new setup next to yours, and none of yours change. Check any values marked placeholder against your own vehicle.</p>
    </Modal>
  );
}
