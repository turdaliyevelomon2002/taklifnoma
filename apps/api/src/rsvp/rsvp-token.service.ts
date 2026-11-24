import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { RSVP_LIMITS } from '@taklifnoma/shared';
import { AppConfig } from '../config/app-config.service';

export type TokenCheck = 'ok' | 'invalid' | 'expired' | 'too_fast';

/**
 * Stateless forma tokeni: base64url(invitationId.issuedAt.nonce).hmac
 *
 * Bot himoyasi: forma ochilgandan keyin juda tez (3 soniyadan oldin) yuborilsa rad etiladi,
 * token boshqa taklifnoma uchun ishlamaydi va 12 soatdan keyin eskiradi.
 */
@Injectable()
export class RsvpTokenService {
  private readonly secret: string;

  constructor(config: AppConfig) {
    this.secret = config.get('RSVP_SECRET');
  }

  issue(invitationId: string, now = Date.now()): string {
    const payload = Buffer.from(`${invitationId}.${now}.${randomBytes(8).toString('hex')}`).toString(
      'base64url',
    );
    return `${payload}.${this.sign(payload)}`;
  }

  verify(token: string, invitationId: string, now = Date.now()): TokenCheck {
    const [payload, signature] = token.split('.');
    if (!payload || !signature) return 'invalid';

    const expected = Buffer.from(this.sign(payload));
    const given = Buffer.from(signature);
    if (expected.length !== given.length || !timingSafeEqual(expected, given)) return 'invalid';

    const [id, issuedAtRaw] = Buffer.from(payload, 'base64url').toString().split('.');
    const issuedAt = Number(issuedAtRaw);
    if (id !== invitationId || !Number.isFinite(issuedAt)) return 'invalid';

    const age = now - issuedAt;
    if (age < RSVP_LIMITS.minFillMs) return 'too_fast';
    if (age > RSVP_LIMITS.tokenTtlMs) return 'expired';
    return 'ok';
  }

  /** IP manzil xom holda saqlanmaydi: faqat kalitli xesh (bir xil IP'ni solishtirish uchun yetarli). */
  hashIp(ip: string): string {
    return createHmac('sha256', this.secret).update(`ip:${ip}`).digest('hex');
  }

  private sign(payload: string): string {
    return createHmac('sha256', this.secret).update(payload).digest('base64url');
  }
}
