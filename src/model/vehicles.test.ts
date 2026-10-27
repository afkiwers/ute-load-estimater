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

  it('starts new setups on the Cannon Alpha Vanta 3.0L diesel', () => {
    const s = newSetup();
    expect(DEFAULT_VEHICLE).toBe('alpha-vanta-30d');
    expect(s.ute).toMatchObject({ model: 'alpha-vanta-30d', name: 'GWM Cannon Alpha Vanta 3.0L diesel', wheelbase: 3350 });
    expect(s.ute.limits).toMatchObject({ gvm: 3495, gcm: 6555, kerb: 2550, payload: 945, brakedTow: 3500, towBallMax: 350 });
    expect(PRESET_PLACEHOLDERS).toEqual(expect.arrayContaining(['ute.limits.frontAxle', 'ute.limits.tare', 'ute.tyre.size', 'hitch.ballOffset']));
  });

  it('switches model, keeping paint, readings, items and the other placeholders', () => {
    const s = newSetup();
    s.ute.paint = '#141518';
    s.uteReadings.front = 1400;
    const items = s.items.length;
    applyVehicle(s, 'cannon-xsr-24d');
    expect(s.ute).toMatchObject({ model: 'cannon-xsr-24d', name: 'GWM Cannon XSR 2.4L diesel', wheelbase: 3230, paint: '#141518' });
    expect(s.ute.limits).toMatchObject({ gvm: 3205, gcm: 6300, payload: 875, tare: 2273 });
    expect(s.uteReadings.front).toBe(1400);
    expect(s.items).toHaveLength(items);
    // The XSR's tare is published; its tyre size too.
    expect(s.placeholders).not.toContain('ute.limits.tare');
    expect(s.placeholders).not.toContain('ute.tyre.size');
    expect(s.placeholders).toEqual(expect.arrayContaining(['ute.limits.rearAxle', 'hitch.ballOffset', 'caravan.limits.atm']));
  });
});
