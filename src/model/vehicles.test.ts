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

  it('has the Isuzu D-MAX from its brochure, with the tare worked out from the full-tank kerb weight', () => {
    const s = newSetup();
    applyVehicle(s, 'dmax-lsu-30d');
    expect(s.ute).toMatchObject({ name: 'Isuzu D-MAX LS-U 3.0L diesel 4x4', bodyStyle: 'ute', wheelbase: 3125, trackFront: 1570, overallLength: 5285 });
    expect(s.ute.tub).toMatchObject({ length: 1570, width: 1530, depth: 490 });
    expect(s.ute.tyre).toMatchObject({ size: '265/60R18' });
    // 76 L tank: 66 L of diesel above the tare's 10 L is 55 kg.
    expect(s.ute.limits).toEqual({ gvm: 3100, gcm: 6000, frontAxle: 1450, rearAxle: 1910, kerb: 2105, tare: 2050, payload: 995, brakedTow: 3500, unbrakedTow: 750, towBallMax: 350 });
    // Isuzu publishes the track, front overhang and tub size, not the kerb split; listings confirm the D-MAX tare.
    expect(s.placeholders).not.toEqual(expect.arrayContaining(['ute.trackFront']));
    expect(s.placeholders).not.toContain('ute.frontOverhang');
    expect(s.placeholders).not.toContain('ute.tub.length');
    expect(s.placeholders).not.toContain('ute.limits.tare');
    expect(s.placeholders).toEqual(expect.arrayContaining(['ute.kerbFrontPct', 'ute.tyre.loadIndex', 'ute.tub.floorHeight']));
    // The 17-inch tyre's load index is Michelin's fitment for the SX.
    applyVehicle(s, 'dmax-sx-30d');
    expect(s.ute.tyre).toMatchObject({ size: '255/65R17', loadIndex: 110 });
    expect(s.placeholders).not.toContain('ute.tyre.loadIndex');
  });

  it('draws the Isuzu MU-X as an SUV', () => {
    const s = newSetup();
    applyVehicle(s, 'mux-lst-30d');
    expect(s.ute).toMatchObject({ name: 'Isuzu MU-X LS-T 3.0L diesel 4x4', bodyStyle: 'suv', wheelbase: 2855, overallLength: 4860, sunroof: false });
    expect(s.ute.tyre).toMatchObject({ size: '265/50R20' });
    expect(s.ute.limits).toMatchObject({ gvm: 2800, gcm: 5900, frontAxle: 1450, rearAxle: 1650, kerb: 2185, tare: 2127, payload: 615 });
    expect(s.placeholders).toEqual(expect.arrayContaining(['ute.tub.length', 'ute.tub.width', 'ute.limits.tare', 'ute.tyre.loadIndex']));
    applyVehicle(s, 'mux-lsm-22d-4x2');
    expect(s.ute.limits).toMatchObject({ gvm: 2700, kerb: 1995, payload: 705 });
    expect(s.placeholders).toContain('ute.limits.frontAxle');
  });

  it('puts the tow ball 200 mm behind the rear bumper until it has been measured', () => {
    const s = newSetup();
    // Cannon Alpha: 5,445 long, 3,350 wheelbase, 950 front overhang, so 1,145 behind the rear axle.
    expect(s.hitch.ballOffset).toBe(1350);
    applyVehicle(s, 'dmax-lsu-30d');
    expect(s.hitch.ballOffset).toBe(1460);
    applyVehicle(s, 'mux-lsu-30d');
    expect(s.hitch.ballOffset).toBe(1300);
    // Measured, so switching model leaves it alone.
    s.hitch.ballOffset = 1240;
    s.placeholders = s.placeholders.filter((p) => p !== 'hitch.ballOffset');
    applyVehicle(s, 'dmax-lsu-30d');
    expect(s.hitch.ballOffset).toBe(1240);
  });
});
