import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Setup } from '../model/types';
import { newSetup, uid, type ItemTemplate } from '../model/presets';

export const STORAGE_KEY = 'ute-load-estimator';
const HISTORY_LIMIT = 80;
const COALESCE_MS = 1200;

interface HistoryState {
  past: Setup[];
  future: Setup[];
  lastKey: string | null;
  lastAt: number;
}

export interface UpdateOptions {
  /**
   * false: no undo step (e.g. intermediate drag moves). A string: consecutive
   * edits with the same key within a short time share one undo step.
   */
  history?: boolean | string;
}

interface AppState {
  setups: Record<string, Setup>;
  order: string[];
  activeId: string;
  customTemplates: ItemTemplate[];
  history: HistoryState;

  update: (fn: (s: Setup) => void, opts?: UpdateOptions) => void;
  setPath: (path: string, value: unknown, opts?: UpdateOptions) => void;
  pushHistory: () => void;
  undo: () => void;
  redo: () => void;

  selectSetup: (id: string) => void;
  createSetup: (name?: string) => void;
  duplicateSetup: () => void;
  renameSetup: (name: string) => void;
  deleteSetup: () => void;
  importSetups: (setups: Setup[]) => number;

  addCustomTemplate: (t: ItemTemplate) => void;
  removeCustomTemplate: (id: string) => void;
}

const emptyHistory = (): HistoryState => ({ past: [], future: [], lastKey: null, lastAt: 0 });

export function getPath(obj: unknown, path: string): unknown {
  return path.split('.').reduce<unknown>((o, k) => (o == null ? undefined : (o as Record<string, unknown>)[k]), obj);
}

function setPathMut(obj: Record<string, unknown>, path: string, value: unknown) {
  const keys = path.split('.');
  let o = obj;
  for (const k of keys.slice(0, -1)) o = o[k] as Record<string, unknown>;
  o[keys[keys.length - 1]] = value;
}

/** Fills in fields added in later versions so old saves keep loading. */
export function normalizeSetup(raw: Partial<Setup>): Setup {
  const base = newSetup(raw.name ?? 'Imported setup');
  const merge = (def: unknown, val: unknown): unknown => {
    if (val === undefined) return def;
    if (def && typeof def === 'object' && !Array.isArray(def) && val && typeof val === 'object' && !Array.isArray(val)) {
      const out: Record<string, unknown> = { ...(val as Record<string, unknown>) };
      for (const [k, v] of Object.entries(def as Record<string, unknown>)) out[k] = merge(v, (val as Record<string, unknown>)[k]);
      return out;
    }
    return val;
  };
  const merged = merge(base, raw) as Setup;
  merged.items = (raw.items ?? []).map((it) => ({ ...it, id: it.id ?? uid() }));
  merged.placeholders = raw.placeholders ?? [];
  return merged;
}

function firstSetup() {
  const s = newSetup('My setup');
  return { setups: { [s.id]: s }, order: [s.id], activeId: s.id };
}

export const useStore = create<AppState>()(
  persist(
    (set, get) => ({
      ...firstSetup(),
      customTemplates: [],
      history: emptyHistory(),

      update: (fn, opts = {}) => {
        const { setups, activeId, history } = get();
        const current = setups[activeId];
        const next = structuredClone(current);
        fn(next);
        next.updatedAt = Date.now();
        const now = Date.now();
        let h = history;
        const mode = opts.history ?? true;
        if (mode !== false) {
          const coalesce = typeof mode === 'string' && mode === history.lastKey && now - history.lastAt < COALESCE_MS;
          h = coalesce
            ? { ...history, lastAt: now }
            : {
                past: [...history.past.slice(-HISTORY_LIMIT + 1), current],
                future: [],
                lastKey: typeof mode === 'string' ? mode : null,
                lastAt: now,
              };
        }
        set({ setups: { ...setups, [activeId]: next }, history: h });
      },

      setPath: (path, value, opts) => {
        get().update(
          (s) => {
            setPathMut(s as unknown as Record<string, unknown>, path, value);
            s.placeholders = s.placeholders.filter((p) => p !== path);
          },
          { history: path, ...opts },
        );
      },

      pushHistory: () => {
        const { setups, activeId, history } = get();
        set({
          history: { past: [...history.past.slice(-HISTORY_LIMIT + 1), setups[activeId]], future: [], lastKey: null, lastAt: Date.now() },
        });
      },

      undo: () => {
        const { setups, activeId, history } = get();
        const prev = history.past[history.past.length - 1];
        if (!prev) return;
        set({
          setups: { ...setups, [activeId]: prev },
          history: { past: history.past.slice(0, -1), future: [setups[activeId], ...history.future], lastKey: null, lastAt: 0 },
        });
      },

      redo: () => {
        const { setups, activeId, history } = get();
        const next = history.future[0];
        if (!next) return;
        set({
          setups: { ...setups, [activeId]: next },
          history: { past: [...history.past, setups[activeId]], future: history.future.slice(1), lastKey: null, lastAt: 0 },
        });
      },

      selectSetup: (id) => {
        if (get().setups[id]) set({ activeId: id, history: emptyHistory() });
      },

      createSetup: (name) => {
        const s = newSetup(name ?? `Setup ${get().order.length + 1}`);
        set((st) => ({ setups: { ...st.setups, [s.id]: s }, order: [...st.order, s.id], activeId: s.id, history: emptyHistory() }));
      },

      duplicateSetup: () => {
        const { setups, activeId } = get();
        const copy = structuredClone(setups[activeId]);
        copy.id = uid();
        copy.name = `${copy.name} (copy)`;
        copy.updatedAt = Date.now();
        set((st) => ({ setups: { ...st.setups, [copy.id]: copy }, order: [...st.order, copy.id], activeId: copy.id, history: emptyHistory() }));
      },

      renameSetup: (name) => get().update((s) => void (s.name = name), { history: 'rename' }),

      deleteSetup: () => {
        const { setups, order, activeId } = get();
        if (order.length <= 1) {
          const fresh = firstSetup();
          set({ ...fresh, history: emptyHistory() });
          return;
        }
        const rest = { ...setups };
        delete rest[activeId];
        const newOrder = order.filter((id) => id !== activeId);
        set({ setups: rest, order: newOrder, activeId: newOrder[0], history: emptyHistory() });
      },

      importSetups: (list) => {
        const added = list.map((raw) => {
          const s = normalizeSetup(raw);
          if (get().setups[s.id]) s.id = uid();
          return s;
        });
        if (!added.length) return 0;
        set((st) => {
          const setups = { ...st.setups };
          for (const s of added) setups[s.id] = s;
          return { setups, order: [...st.order, ...added.map((s) => s.id)], activeId: added[0].id, history: emptyHistory() };
        });
        return added.length;
      },

      addCustomTemplate: (t) => set((st) => ({ customTemplates: [...st.customTemplates, t] })),
      removeCustomTemplate: (id) => set((st) => ({ customTemplates: st.customTemplates.filter((t) => t.id !== id) })),
    }),
    {
      name: STORAGE_KEY,
      version: 1,
      partialize: (st) => ({ setups: st.setups, order: st.order, activeId: st.activeId, customTemplates: st.customTemplates }),
      merge: (persisted, current) => {
        const p = persisted as Partial<AppState> | undefined;
        if (!p?.setups || !p.order?.length) return current;
        const setups: Record<string, Setup> = {};
        for (const id of p.order) if (p.setups[id]) setups[id] = normalizeSetup(p.setups[id]);
        const order = Object.keys(setups);
        if (!order.length) return current;
        return {
          ...current,
          setups,
          order,
          activeId: p.activeId && setups[p.activeId] ? p.activeId : order[0],
          customTemplates: p.customTemplates ?? [],
        };
      },
    },
  ),
);

export function useActive<T>(selector: (s: Setup) => T): T {
  return useStore((st) => selector(st.setups[st.activeId]));
}

export const activeSetup = () => {
  const st = useStore.getState();
  return st.setups[st.activeId];
};
