import type { AppConfig } from '../config/app-config.service';
import { RsvpTokenService } from './rsvp-token.service';

const config = { get: () => 'test-secret-0123456789-0123456789-abcdef' } as unknown as AppConfig;
const tokens = new RsvpTokenService(config);
const INV = '7c0d1f3e-4b9a-4c3e-9a51-2f1f5a0b8c11';

describe('RsvpTokenService', () => {
  const t0 = 1_800_000_000_000;

  it("3 soniyadan keyin va 12 soat ichida to'g'ri token qabul qilinadi", () => {
    const token = tokens.issue(INV, t0);
    expect(tokens.verify(token, INV, t0 + 5_000)).toBe('ok');
  });

  it('juda tez yuborilsa too_fast', () => {
    const token = tokens.issue(INV, t0);
    expect(tokens.verify(token, INV, t0 + 1_000)).toBe('too_fast');
  });

  it("12 soatdan keyin eskiradi", () => {
    const token = tokens.issue(INV, t0);
    expect(tokens.verify(token, INV, t0 + 13 * 3600_000)).toBe('expired');
  });

  it("boshqa taklifnoma yoki o'zgartirilgan token rad etiladi", () => {
    const token = tokens.issue(INV, t0);
    expect(tokens.verify(token, 'other-id', t0 + 5_000)).toBe('invalid');
    const [payload, sig] = token.split('.');
    const forged = Buffer.from(`${INV}.${t0 - 60_000}.00`).toString('base64url');
    expect(tokens.verify(`${forged}.${sig}`, INV, t0 + 5_000)).toBe('invalid');
    expect(tokens.verify(`${payload}`, INV, t0 + 5_000)).toBe('invalid');
    expect(tokens.verify('garbage', INV, t0 + 5_000)).toBe('invalid');
  });

  it('IP xeshi deterministik va xom IP saqlanmaydi', () => {
    expect(tokens.hashIp('1.2.3.4')).toBe(tokens.hashIp('1.2.3.4'));
    expect(tokens.hashIp('1.2.3.4')).not.toContain('1.2.3.4');
    expect(tokens.hashIp('1.2.3.4')).not.toBe(tokens.hashIp('1.2.3.5'));
  });
});
