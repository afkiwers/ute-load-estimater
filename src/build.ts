// What this copy of the app is. Release builds get their tag, commit and dates from the
// release workflow (see vite.config.ts); local and CI builds leave them empty so the
// committed file stays reproducible.

export interface BuildStamp {
  /** Release tag, e.g. "v1.0.2"; null for a development build. */
  version: string | null;
  commit: string | null;
  /** ISO 8601. */
  commitDate: string | null;
  /** ISO 8601, UTC. */
  buildDate: string | null;
}

declare const __BUILD__: BuildStamp;

export const BUILD: BuildStamp = __BUILD__;

export const REPO_URL = 'https://github.com/afkiwers/ute-load-estimater';
export const APP_URL = 'https://afkiwers.github.io/ute-load-estimater/';
export const LATEST_RELEASE_API = 'https://api.github.com/repos/afkiwers/ute-load-estimater/releases/latest';

export function versionLabel(b: BuildStamp): string {
  return b.version ?? 'dev';
}

function parseVersion(tag: string): number[] | null {
  const m = /^v?(\d+(?:\.\d+)*)$/.exec(tag.trim());
  return m ? m[1].split('.').map(Number) : null;
}

/** Whether the latest release tag is newer than this build's. Tags that are not plain numbers only compare equal or not. */
export function isNewer(latest: string, current: string): boolean {
  const a = parseVersion(latest);
  const b = parseVersion(current);
  if (!a || !b) return latest.trim() !== current.trim();
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    const d = (a[i] ?? 0) - (b[i] ?? 0);
    if (d) return d > 0;
  }
  return false;
}

export interface AboutRow {
  label: string;
  value: string;
  href?: string;
}

export interface Runtime {
  react: string;
  three: string;
  protocol: string;
  host: string;
}

export function versionRows(b: BuildStamp, rt: Runtime): AboutRow[] {
  return [
    { label: 'Version', value: b.version ?? 'Development build' },
    { label: 'Commit', value: b.commit ? b.commit.slice(0, 7) : '–', href: b.commit ? `${REPO_URL}/commit/${b.commit}` : undefined },
    { label: 'Commit date', value: b.commitDate ? b.commitDate.slice(0, 10) : '–' },
    { label: 'Build date', value: b.buildDate ? `${b.buildDate.slice(0, 16).replace('T', ' ')} UTC` : '–' },
    { label: 'Running from', value: rt.protocol === 'file:' ? 'Downloaded file' : rt.host },
    { label: 'React', value: rt.react },
    { label: 'three.js', value: `r${rt.three}` },
  ];
}

/** Plain text for bug reports. */
export function versionReport(rows: AboutRow[], userAgent: string): string {
  return ['Ute Load Estimator', ...rows.map((r) => `${r.label}: ${r.value}`), `Browser: ${userAgent}`].join('\n');
}
