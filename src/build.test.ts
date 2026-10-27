import { describe, expect, it } from 'vitest';
import { BUILD, isNewer, versionLabel, versionReport, versionRows } from './build';

const runtime = { react: '19.2.0', three: '186', protocol: 'https:', host: 'afkiwers.github.io' };

describe('build info', () => {
  it('is a development build unless the release workflow stamps it', () => {
    expect(BUILD).toEqual({ version: null, commit: null, commitDate: null, buildDate: null });
    expect(versionLabel(BUILD)).toBe('dev');
  });

  it('compares release tags by number', () => {
    expect(isNewer('v1.0.10', 'v1.0.9')).toBe(true);
    expect(isNewer('v1.1', 'v1.0.9')).toBe(true);
    expect(isNewer('v1.0.2', '1.0.2')).toBe(false);
    expect(isNewer('v1.0.1', 'v1.0.2')).toBe(false);
    expect(isNewer('v1.1.0-beta', 'v1.0.2')).toBe(true);
  });

  it('lists a release build and copies it as text', () => {
    const stamp = { version: 'v1.0.2', commit: '636249c0d8b98c9542d644df87f46857b9e6d6c7', commitDate: '2026-10-27T07:52:39+00:00', buildDate: '2026-10-27T08:03:11Z' };
    const rows = versionRows(stamp, runtime);
    expect(rows.find((r) => r.label === 'Commit')).toEqual({
      label: 'Commit',
      value: '636249c',
      href: 'https://github.com/afkiwers/vehicle-load-estimater/commit/636249c0d8b98c9542d644df87f46857b9e6d6c7',
    });
    expect(versionReport(rows, 'Chrome')).toBe(
      [
        'Vehicle Load Estimator',
        'Version: v1.0.2',
        'Commit: 636249c',
        'Commit date: 2026-10-27',
        'Build date: 2026-10-27 08:03 UTC',
        'Running from: afkiwers.github.io',
        'React: 19.2.0',
        'three.js: r186',
        'License: GPL-3.0-or-later',
        'Browser: Chrome',
      ].join('\n'),
    );
  });

  it('says when it runs from a downloaded file', () => {
    expect(versionRows(BUILD, { ...runtime, protocol: 'file:', host: '' }).find((r) => r.label === 'Running from')!.value).toBe('Downloaded file');
  });
});
