import { describe, expect, it } from 'vitest';
import { decodeSetup, encodeSetup, sharePayload, shareUrl } from './share';
import { ITEM_TEMPLATES, applyVehicle, itemFromTemplate, newSetup } from './model/presets';

function loaded() {
  const s = newSetup('Lap of Australia');
  applyVehicle(s, 'cannon-xsr-24d');
  s.uteReadings = { total: null, front: 1420, rear: 1180, fl: 705, fr: 715, rl: 585, rr: 595 };
  s.caravanReadings = { ...s.caravanReadings, total: 2500, ball: 240 };
  for (const t of ITEM_TEMPLATES.slice(0, 12)) s.items.push(itemFromTemplate(t, s));
  return s;
}

describe('share links', () => {
  it('carries a whole setup and gives the person opening it their own copy', async () => {
    const s = loaded();
    const back = await decodeSetup(await encodeSetup(s));
    expect(back.id).not.toBe(s.id);
    expect({ ...back, id: s.id, updatedAt: s.updatedAt }).toEqual(s);
  });

  it('stays short enough for messages and QR codes', async () => {
    const url = shareUrl(await encodeSetup(loaded()), { protocol: 'https:', origin: 'https://afkiwers.github.io', pathname: '/vehicle-load-estimater/' });
    expect(url.length).toBeLessThan(2500);
  });

  it('points a downloaded copy at the online app, and anything else at itself', () => {
    expect(shareUrl('zAB', { protocol: 'file:', origin: 'null', pathname: '/x.html' })).toBe('https://afkiwers.github.io/vehicle-load-estimater/#s=zAB');
    expect(shareUrl('zAB', { protocol: 'http:', origin: 'http://localhost:5173', pathname: '/' })).toBe('http://localhost:5173/#s=zAB');
  });

  it('finds the setup in the address and rejects damaged links', async () => {
    expect(sharePayload('#s=zAb-_9')).toBe('zAb-_9');
    expect(sharePayload('#other')).toBeNull();
    const payload = await encodeSetup(loaded());
    await expect(decodeSetup(payload.slice(0, 40))).rejects.toThrow();
    await expect(decodeSetup('q' + payload.slice(1))).rejects.toThrow();
  });

  it('reads the uncompressed form too', async () => {
    const s = loaded();
    const bytes = new TextEncoder().encode(JSON.stringify(s));
    const plain = 'j' + btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
    expect((await decodeSetup(plain)).name).toBe('Lap of Australia');
  });
});
