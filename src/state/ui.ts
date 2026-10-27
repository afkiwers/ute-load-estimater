import { create } from 'zustand';
import type { Host, ItemSize, ItemShape, Vec3 } from '../model/types';

export type Tab = 'results' | 'ute' | 'towing' | 'items';

/** Below this width the items list is a drawer over the page rather than a column. */
export const NARROW = '(max-width: 900px)';
const PALETTE_KEY = 'ute-load-estimator:palette';

export const isNarrow = () => typeof matchMedia === 'function' && matchMedia(NARROW).matches;

/** Open on wide screens unless the viewer closed it there before; closed as a drawer. */
export function paletteDefault(): boolean {
  if (isNarrow()) return false;
  try {
    return localStorage.getItem(PALETTE_KEY) !== 'closed';
  } catch {
    return true;
  }
}
export type ViewPreset = 'iso' | 'side' | 'top' | 'front' | 'rear' | 'ute' | 'caravan';

export interface DropPreview {
  host: Host;
  pos: Vec3;
  size: ItemSize;
  shape: ItemShape;
  color: string;
}

interface UiState {
  tab: Tab;
  selectedId: string | null;
  draggingId: string | null;
  dropPreview: DropPreview | null;
  xray: boolean;
  labels: boolean;
  view: { preset: ViewPreset; nonce: number };
  toast: { text: string; nonce: number } | null;
  snapshot: string | null;
  paletteOpen: boolean;

  setTab: (t: Tab) => void;
  select: (id: string | null) => void;
  setDragging: (id: string | null) => void;
  setDropPreview: (p: DropPreview | null) => void;
  setXray: (v: boolean) => void;
  setLabels: (v: boolean) => void;
  setView: (preset: ViewPreset) => void;
  showToast: (text: string) => void;
  setSnapshot: (s: string | null) => void;
  setPaletteOpen: (open: boolean) => void;
}

export const useUi = create<UiState>()((set) => ({
  tab: 'results',
  selectedId: null,
  draggingId: null,
  dropPreview: null,
  xray: false,
  labels: true,
  view: { preset: 'iso', nonce: 0 },
  toast: null,
  snapshot: null,
  paletteOpen: paletteDefault(),

  setTab: (tab) => set({ tab }),
  select: (selectedId) => set({ selectedId }),
  setDragging: (draggingId) => set({ draggingId }),
  setDropPreview: (dropPreview) => set({ dropPreview }),
  setXray: (xray) => set({ xray }),
  setLabels: (labels) => set({ labels }),
  setView: (preset) => set((s) => ({ view: { preset, nonce: s.view.nonce + 1 } })),
  showToast: (text) => set((s) => ({ toast: { text, nonce: (s.toast?.nonce ?? 0) + 1 } })),
  setSnapshot: (snapshot) => set({ snapshot }),
  setPaletteOpen: (paletteOpen) => {
    if (!isNarrow()) {
      try {
        localStorage.setItem(PALETTE_KEY, paletteOpen ? 'open' : 'closed');
      } catch {
        // Storage blocked: it just won't be remembered.
      }
    }
    set({ paletteOpen });
  },
}));

/** Bridges the three.js scene to DOM handlers (palette drops, report snapshots). */
export interface SceneBridge {
  pick: (clientX: number, clientY: number, excludeId?: string) => SceneHit | null;
  snapshot: () => string | null;
}

export interface SceneHit {
  host: Host;
  /** Hit point and outward surface normal in the host frame (mm). */
  point: Vec3;
  normal: Vec3;
  surface: string;
}

export const sceneBridge: { current: SceneBridge | null } = { current: null };

/**
 * DOM layer over the canvas that 3D labels render into. drei's Html otherwise
 * picks its container from the event state, which changes after the first
 * label mounts and leaves that label empty.
 */
export const labelLayer: { current: HTMLElement | null } = { current: null };
