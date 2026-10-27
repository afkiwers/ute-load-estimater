import { useEffect, useState, version as reactVersion } from 'react';
import { REVISION } from 'three';
import { APP_URL, BUILD, LATEST_RELEASE_API, REPO_URL, isNewer, versionReport, versionRows } from '../build';
import { useUi } from '../state/ui';
import { Modal } from './Modal';

type Latest = { state: 'checking' } | { state: 'failed' } | { state: 'found'; tag: string; url: string };

async function copy(text: string, what: string) {
  try {
    await navigator.clipboard.writeText(text);
  } catch {
    // Older browsers, or a page the clipboard API refuses.
    const area = document.createElement('textarea');
    area.value = text;
    area.style.position = 'fixed';
    area.style.opacity = '0';
    document.body.appendChild(area);
    area.select();
    document.execCommand('copy');
    area.remove();
  }
  useUi.getState().showToast(`${what} copied.`);
}

function CopyIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="9" y="9" width="12" height="12" rx="2" />
      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
    </svg>
  );
}

/** Asks GitHub for the latest release; only when the dialog opens, and quietly gives up offline. */
function useLatestRelease(): Latest {
  const [latest, setLatest] = useState<Latest>({ state: 'checking' });
  useEffect(() => {
    const abort = new AbortController();
    fetch(LATEST_RELEASE_API, { signal: abort.signal })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`))))
      .then((d: { tag_name: string; html_url: string }) => setLatest({ state: 'found', tag: d.tag_name, url: d.html_url }))
      .catch(() => !abort.signal.aborted && setLatest({ state: 'failed' }));
    return () => abort.abort();
  }, []);
  return latest;
}

function UpdateBadge({ latest }: { latest: Latest }) {
  if (latest.state === 'checking') return <span className="about-note">Checking for updates…</span>;
  if (latest.state === 'failed') return <span className="about-note">Couldn't check for updates</span>;
  if (!BUILD.version) {
    return (
      <a className="badge badge-dev" href={latest.url} target="_blank" rel="noreferrer" title="This copy was not built from a release">
        Development build · latest {latest.tag}
      </a>
    );
  }
  return isNewer(latest.tag, BUILD.version) ? (
    <a className="badge badge-update" href={location.protocol === 'file:' ? latest.url : APP_URL} target="_blank" rel="noreferrer" title={`${latest.tag} is out`}>
      Update available
    </a>
  ) : (
    <span className="badge badge-current">Up to date</span>
  );
}

const LINKS = [
  { label: 'Online app', href: APP_URL },
  { label: 'Source code', href: REPO_URL },
  { label: 'Releases and downloads', href: `${REPO_URL}/releases` },
  { label: 'Report a problem', href: `${REPO_URL}/issues/new` },
  { label: 'License', href: `${REPO_URL}/blob/main/LICENSE`, text: 'GNU GPL v3.0 or later' },
];

export function AboutDialog({ onClose }: { onClose: () => void }) {
  const latest = useLatestRelease();
  const rows = versionRows(BUILD, { react: reactVersion, three: REVISION, protocol: location.protocol, host: location.host });

  return (
    <Modal
      title="About Ute Load Estimator"
      onClose={onClose}
      footer={
        <>
          <button className="btn btn-outline" onClick={() => copy(versionReport(rows, navigator.userAgent), 'Version information')}>
            <CopyIcon /> Copy version information
          </button>
          <button className="btn primary" onClick={onClose}>
            Close
          </button>
        </>
      }
    >
      <div className="about-section">
        <h3>Version information</h3>
        <UpdateBadge latest={latest} />
      </div>
      <table className="about-table">
        <tbody>
          {rows.map((r) => (
            <tr key={r.label}>
              <th>{r.label}</th>
              <td>
                {r.href ? (
                  <a href={r.href} target="_blank" rel="noreferrer">
                    {r.value}
                  </a>
                ) : (
                  r.value
                )}
              </td>
              <td className="about-copy">
                {r.value !== '–' && (
                  <button className="icon-btn" onClick={() => copy(r.value, r.label)} title={`Copy ${r.label.toLowerCase()}`} aria-label={`Copy ${r.label.toLowerCase()}`}>
                    <CopyIcon />
                  </button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="about-section">
        <h3>Links</h3>
      </div>
      <table className="about-table">
        <tbody>
          {LINKS.map((l) => (
            <tr key={l.label}>
              <th>{l.label}</th>
              <td colSpan={2}>
                <a href={l.href} target="_blank" rel="noreferrer">
                  {'text' in l ? l.text : l.href.replace(/^https:\/\//, '')}
                </a>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="about-note">
        Free software: you can redistribute and modify it under the GNU General Public License, version 3 or any later version. It comes with
        absolutely no warranty.
      </p>
    </Modal>
  );
}
