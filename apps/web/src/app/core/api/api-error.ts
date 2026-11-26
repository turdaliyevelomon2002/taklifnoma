import { HttpErrorResponse } from '@angular/common/http';
import type { ApiErrorBody, ErrorCode } from '@taklifnoma/shared';

/** Frontend'ga xos xato: tarmoq yo'q (API'ga yetib bo'lmadi). */
export type ClientErrorCode = ErrorCode | 'NETWORK';

export class ApiRequestError extends Error {
  constructor(
    readonly code: ClientErrorCode,
    readonly status: number,
    readonly body?: ApiErrorBody,
  ) {
    super(code);
  }
}

export function toApiError(err: unknown): ApiRequestError {
  if (err instanceof ApiRequestError) return err;
  if (err instanceof HttpErrorResponse) {
    if (err.status === 0) return new ApiRequestError('NETWORK', 0);
    const body = err.error as ApiErrorBody | null;
    if (body && typeof body === 'object' && 'code' in body) {
      return new ApiRequestError(body.code, err.status, body);
    }
    if (err.status === 429) return new ApiRequestError('RATE_LIMITED', 429);
    if (err.status === 401) return new ApiRequestError('UNAUTHORIZED', 401);
  }
  return new ApiRequestError('INTERNAL_ERROR', 500);
}

/** i18n fayllarida (`errors.*`) matni bor kodlar; qolganlari umumiy xabar bilan ko'rsatiladi. */
const TRANSLATED: ReadonlySet<ClientErrorCode> = new Set<ClientErrorCode>([
  'VALIDATION_ERROR',
  'UNAUTHORIZED',
  'FORBIDDEN',
  'NOT_FOUND',
  'RATE_LIMITED',
  'INVALID_CREDENTIALS',
  'PIN_LOCKED',
  'FEATURE_DISABLED',
  'CONFLICT',
  'SLUG_TAKEN',
  'GALLERY_LIMIT_REACHED',
  'UNSUPPORTED_FILE_TYPE',
  'FILE_TOO_LARGE',
  'FILE_REQUIRED',
  'RSVP_CLOSED',
  'FORM_EXPIRED',
  'SPAM_DETECTED',
  'PHONE_REQUIRED',
  'TOO_MANY_GUESTS',
  'TELEGRAM_REQUIRED',
  'TELEGRAM_AUTH_INVALID',
  'PHONE_TAKEN',
  'REPLY_REQUIRED',
  'WISH_LIMIT_REACHED',
  'INVITATION_INCOMPLETE',
  'NETWORK',
  'INTERNAL_ERROR',
]);

export function errorKey(code: ClientErrorCode): string {
  return `errors.${TRANSLATED.has(code) ? code : 'INTERNAL_ERROR'}`;
}

/** Promise -> ApiRequestError bilan (HttpClient observable'lari uchun). */
export async function request<T>(promise: Promise<T>): Promise<T> {
  try {
    return await promise;
  } catch (err) {
    throw toApiError(err);
  }
}
