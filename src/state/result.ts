import { compute, type Result } from '../model/calc';
import type { Setup } from '../model/types';
import { useStore } from './store';

// Setups are replaced on every edit, so the object itself is a safe cache key.
const cache = new WeakMap<Setup, Result>();

export function resultFor(setup: Setup): Result {
  let r = cache.get(setup);
  if (!r) {
    r = compute(setup);
    cache.set(setup, r);
  }
  return r;
}

export function useSetup(): Setup {
  return useStore((s) => s.setups[s.activeId]);
}

export function useResult(): Result {
  return resultFor(useSetup());
}
