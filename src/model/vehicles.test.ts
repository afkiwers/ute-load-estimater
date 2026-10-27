import { describe, expect, it } from 'vitest';
import { applyVehicle, newSetup, PRESET_PLACEHOLDERS } from './presets';
import { DEFAULT_VEHICLE, VEHICLES, vehicleModel } from './vehicles';

const at = (obj: unknown, path: string) => path.split('.').reduce<unknown>((o, k) => (o as Record<string, unknown> | undefined)?.[k], obj);

describe('vehicle models', () => {
  it.each(VEHICLES.map((v) => [v.label, v.id]))('%s has consistent figures', (_label, id) => {
    const model = vehicleModel(id);
    const ute = { ute: model.spec() };
    const lim = ute.ute.limits;
    expect(ute.ute.model).toBe(id);
    expect(lim.kerb! + lim.payload!).toBe(lim.gvm);
    expect(lim.gcm!).toBeGreaterThan(lim.gvm!);
    expect(lim.tare!).toBeLessThan(lim.kerb!);
    expect(lim.towBallMax!).toBeLessThanOrEqual(lim.brakedTow! * 0.1);
    // Axle limits together must allow the GVM.
    expect(lim.frontAxle! + lim.rearAxle!).toBeGreaterThanOrEqual(lim.gvm!);
    for (const path of model.placeholders) expect(at(ute, path), path).not.toBeUndefined();
  });

  it('starts new setups on the Cannon Alpha Vanta 3.0L diesel, as in the brochure', () => {
    const s = newSetup();
    expect(DEFAULT_VEHICLE).toBe('alpha-vanta-30d');
    expect(s.ute).toMatchObject({ model: 'alpha-vanta-30d', name: 'GWM Cannon Alpha Vanta 3.0L diesel', wheelbase: 3350 });
    expect(s.ute.tyre).toMatchObject({ size: '265/55R19', loadIndex: 109 });
    expect(s.ute.limits).toEqual({ gvm: 3495, gcm: 6555, frontAxle: 1680, rearAxle: 2026, kerb: 2550, tare: 2458, payload: 945, brakedTow: 3500, unbrakedTow: 750, towBallMax: 350 });
    // Published in the brochure, so no placeholders; the tub and kerb split are not.
    expect(PRESET_PLACEHOLDERS).not.toEqual(expect.arrayContaining(['ute.limits.rearAxle']));
    expect(PRESET_PLACEHOLDERS).not.toContain('ute.limits.tare');
    expect(PRESET_PLACEHOLDERS).toEqual(expect.arrayContaining(['ute.tub.length', 'ute.kerbFrontPct', 'hitch.ballOffset']));
  });

  it('switches model, keeping paint, readings, items and the other placeholders', () => {
    const s = newSetup();
    s.ute.paint = '#141518';
    s.uteReadings.front = 1400;
    const items = s.items.length;
    applyVehicle(s, 'cannon-xsr-24d');
    expect(s.ute).toMatchObject({ model: 'cannon-xsr-24d', name: 'GWM Cannon XSR 2.4L diesel', wheelbase: 3230, overallWidth: 1958, paint: '#141518' });
    expect(s.ute.limits).toMatchObject({ gvm: 3205, gcm: 6300, frontAxle: 1585, rearAxle: 1850, payload: 875, tare: 2273 });
    // From the axle loads at kerb weight: 1345 / 985 kg.
    expect(s.ute.kerbFrontPct).toBe(57.7);
    expect(s.uteReadings.front).toBe(1400);
    expect(s.items).toHaveLength(items);
    expect(s.placeholders).not.toContain('ute.limits.rearAxle');
    expect(s.placeholders).not.toContain('ute.tub.length');
    expect(s.placeholders).toEqual(expect.arrayContaining(['ute.tyre.loadIndex', 'hitch.ballOffset', 'caravan.limits.atm']));
  });

  it('marks the typical axle limits of earlier models as placeholders', () => {
    const s = newSetup();
    applyVehicle(s, 'cannon-x-20d');
    expect(s.ute.limits).toMatchObject({ gvm: 3150, brakedTow: 3000, kerb: 2100, payload: 1050 });
    expect(s.placeholders).toEqual(expect.arrayContaining(['ute.limits.frontAxle', 'ute.limits.rearAxle', 'ute.limits.gcm']));
  });
});
