import type { CookieOptions, Response } from 'express';

export const OWNER_COOKIE = 'tk_owner';
export const COUPLE_COOKIE = 'tk_couple';

export const OWNER_SESSION_TTL_SEC = 7 * 24 * 3600;
export const COUPLE_SESSION_TTL_SEC = 30 * 24 * 3600;

function baseOptions(secure: boolean): CookieOptions {
  return { httpOnly: true, secure, sameSite: 'lax', path: '/api' };
}

export function setSessionCookie(
  res: Response,
  name: string,
  token: string,
  ttlSec: number,
  secure: boolean,
): void {
  res.cookie(name, token, { ...baseOptions(secure), maxAge: ttlSec * 1000 });
}

export function clearSessionCookie(res: Response, name: string, secure: boolean): void {
  res.clearCookie(name, baseOptions(secure));
}
