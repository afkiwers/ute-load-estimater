import { useEffect, useState, type ReactNode } from 'react';
import { getPath, useActive, useStore } from '../state/store';
import { num } from '../model/format';
import type { Issue } from '../model/calc';

export function PlaceholderChip({ path }: { path: string }) {
  const update = useStore((s) => s.update);
  return (
    <button
      type="button"
      className="ph-chip"
      title="Typical value, not verified. Check it against your placard or the manufacturer, then click to mark it as verified."
      onClick={(e) => {
        e.preventDefault();
        update((s) => void (s.placeholders = s.placeholders.filter((p) => p !== path)));
      }}
    >
      placeholder
    </button>
  );
}

function parseNumber(text: string): number | null | undefined {
  const t = text.trim().replace(/,/g, '');
  if (t === '') return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : undefined;
}

interface NumInputProps {
  value: number | null;
  onChange: (v: number | null) => void;
  unit?: string;
  derived?: number | null;
  nullable?: boolean;
  min?: number;
  ariaLabel?: string;
}

/** Number input that keeps the typed text while focused and accepts empty as "not set". */
export function NumInput({ value, onChange, unit, derived, nullable = true, min, ariaLabel }: NumInputProps) {
  const [text, setText] = useState(value == null ? '' : String(value));
  const [focused, setFocused] = useState(false);
  useEffect(() => {
    if (!focused) setText(value == null ? '' : String(value));
  }, [value, focused]);
  return (
    <span className="field-input">
      <input
        inputMode="decimal"
        aria-label={ariaLabel}
        value={text}
        placeholder={derived != null ? `≈ ${num(derived)}` : nullable ? 'not set' : ''}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        onChange={(e) => {
          setText(e.target.value);
          const n = parseNumber(e.target.value);
          if (n === undefined) return;
          if (n === null && !nullable) return;
          if (n !== null && min != null && n < min) return;
          onChange(n);
        }}
      />
      {unit && <span className="unit">{unit}</span>}
    </span>
  );
}

interface NumFieldProps {
  path: string;
  label: ReactNode;
  unit?: string;
  hint?: ReactNode;
  derived?: number | null;
  flag?: 'warn' | 'error' | null;
  nullable?: boolean;
  min?: number;
}

/** Number field bound to a dotted path in the active setup. */
export function NumField({ path, label, unit = 'kg', hint, derived, flag, nullable = true, min }: NumFieldProps) {
  const value = useActive((s) => getPath(s, path) as number | null);
  const placeholder = useActive((s) => s.placeholders.includes(path));
  const setPath = useStore((s) => s.setPath);
  return (
    <label className={`field${flag ? ` field-${flag}` : ''}`}>
      <span className="field-label">
        {label}
        {placeholder && <PlaceholderChip path={path} />}
      </span>
      <NumInput value={value} onChange={(v) => setPath(path, v)} unit={unit} derived={derived} nullable={nullable} min={min} ariaLabel={typeof label === 'string' ? label : path} />
      {hint && <span className="field-hint">{hint}</span>}
    </label>
  );
}

/** A value worked out from other fields, shown in line with them. */
export function ReadField({ label, value, unit = 'kg', hint }: { label: ReactNode; value: number | null; unit?: string; hint?: ReactNode }) {
  return (
    <div className="field field-read">
      <span className="field-label">{label}</span>
      <span className="field-input">
        <input readOnly tabIndex={-1} value={value == null ? '' : num(value)} placeholder="–" aria-label={typeof label === 'string' ? label : undefined} />
        {unit && <span className="unit">{unit}</span>}
      </span>
      {hint && <span className="field-hint">{hint}</span>}
    </div>
  );
}

export function TextField({ path, label, hint }: { path: string; label: ReactNode; hint?: ReactNode }) {
  const value = useActive((s) => getPath(s, path) as string);
  const placeholder = useActive((s) => s.placeholders.includes(path));
  const setPath = useStore((s) => s.setPath);
  return (
    <label className="field">
      <span className="field-label">
        {label}
        {placeholder && <PlaceholderChip path={path} />}
      </span>
      <span className="field-input">
        <input value={value} onChange={(e) => setPath(path, e.target.value)} />
      </span>
      {hint && <span className="field-hint">{hint}</span>}
    </label>
  );
}

export function Toggle({ path, label }: { path: string; label: ReactNode }) {
  const value = useActive((s) => Boolean(getPath(s, path)));
  const setPath = useStore((s) => s.setPath);
  return (
    <label className="toggle">
      <input type="checkbox" checked={value} onChange={(e) => setPath(path, e.target.checked)} />
      <span>{label}</span>
    </label>
  );
}

export function Section({ title, extra, children, open = true }: { title: ReactNode; extra?: ReactNode; children: ReactNode; open?: boolean }) {
  return (
    <details className="section" open={open}>
      <summary>
        {title}
        {extra != null && <span className="summary-extra">{extra}</span>}
      </summary>
      <div className="section-body">{children}</div>
    </details>
  );
}

export function IssueList({ issues }: { issues: Issue[] }) {
  if (!issues.length) return null;
  return (
    <ul className="issues">
      {issues.map((i, k) => (
        <li key={k} className={`issue issue-${i.level}`}>
          {i.message}
        </li>
      ))}
    </ul>
  );
}

/** Highest issue level mentioning a field path, for highlighting inputs. */
export function flagFor(issues: Issue[], path: string): 'warn' | 'error' | null {
  let flag: 'warn' | 'error' | null = null;
  for (const i of issues) {
    if (!i.fields?.includes(path)) continue;
    if (i.level === 'error') return 'error';
    if (i.level === 'warn') flag = 'warn';
  }
  return flag;
}
