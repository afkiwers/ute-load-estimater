import { useState } from 'react';

const KEY = 'ute-load-estimator:disclaimer';

function acknowledged(): boolean {
  try {
    return localStorage.getItem(KEY) === 'acknowledged';
  } catch {
    return false;
  }
}

/** Shown until the viewer acknowledges once that the results are estimates to confirm on real scales. */
export function Disclaimer() {
  const [open, setOpen] = useState(() => !acknowledged());
  if (!open) return null;
  return (
    <div className="disclaimer" role="alertdialog" aria-labelledby="disclaimer-title" aria-describedby="disclaimer-text">
      <div className="disclaimer-text">
        <strong id="disclaimer-title">This app gives estimates only.</strong>{' '}
        <span id="disclaimer-text">
          It works from the figures you enter and typical values, and it can be wrong. Before you head off, weigh your vehicle and trailer, loaded
          as you will travel, at a weighbridge or with a mobile weighing service using real scales, and check every result against your
          placards.
        </span>
      </div>
      <button
        className="btn primary"
        autoFocus
        onClick={() => {
          try {
            localStorage.setItem(KEY, 'acknowledged');
          } catch {
            // Storage blocked: it shows again next time.
          }
          setOpen(false);
        }}
      >
        I understand
      </button>
    </div>
  );
}
