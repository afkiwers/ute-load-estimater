import { compute, type Result } from '../model/calc';
import type { Setup } from '../model/types';
import { useStore } from './store';
import { useUi } from './ui';

// Setups are replaced on every edit, so the object itself is a safe cache key; each keeps a result per slope.
const cache = new WeakMap<Setup, Map<number, Result>>();

export function resultFor(setup: Setup, grade = 0): Result {
  let bySlope = cache.get(setup);
  if (!bySlope) {
    bySlope = new Map();
    cache.set(setup, bySlope);
  }
  let r = bySlope.get(grade);
  if (!r) {
    r = compute(setup, { grade });
    // Dragging the slope slider visits many grades: keep only the latest few.
    if (bySlope.size > 4) bySlope.delete(bySlope.keys().next().value!);
    bySlope.set(grade, r);
  }
  return r;
}

export function useSetup(): Setup {
  return useStore((s) => s.setups[s.activeId]);
}

export function useResult(): Result {
  return resultFor(useSetup(), useUi((s) => s.slope));
}
