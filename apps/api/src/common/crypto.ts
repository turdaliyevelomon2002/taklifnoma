import { createHash, randomBytes, randomInt, timingSafeEqual } from 'node:crypto';
import * as argon2 from 'argon2';

/** URL uchun xavfsiz tasodifiy token (32 bayt = 256 bit). */
export function randomToken(bytes = 32): string {
  return randomBytes(bytes).toString('base64url');
}

export function sha256(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

/** Ikki hex xeshni vaqtga bog'liq bo'lmagan usulda solishtiradi. */
export function safeEqualHex(a: string, b: string): boolean {
  const ba = Buffer.from(a, 'hex');
  const bb = Buffer.from(b, 'hex');
  return ba.length === bb.length && timingSafeEqual(ba, bb);
}

export function randomPin(length = 6): string {
  let pin = '';
  for (let i = 0; i < length; i++) pin += randomInt(0, 10).toString();
  return pin;
}

/** Inson o'qiy oladigan qisqa kod (deep-link uchun): o'xshash belgilar (0/O, 1/l) yo'q. */
export function randomCode(length = 12): string {
  const alphabet = 'abcdefghjkmnpqrstuvwxyz23456789';
  let code = '';
  for (let i = 0; i < length; i++) code += alphabet[randomInt(0, alphabet.length)];
  return code;
}

const ARGON_OPTIONS: argon2.Options = { type: argon2.argon2id };

export function hashSecret(value: string): Promise<string> {
  return argon2.hash(value, ARGON_OPTIONS);
}

export async function verifySecret(hash: string, value: string): Promise<boolean> {
  try {
    return await argon2.verify(hash, value);
  } catch {
    return false;
  }
}
