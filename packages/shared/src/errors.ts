/**
 * API xato kodlari. Backend matn emas, kod qaytaradi; frontend uni i18n kalitiga
 * (`errors.<CODE>`) aylantiradi. Shu sababli interfeys matnlari kodda qattiq yozilmaydi.
 */
export const ERROR_CODES = [
  'VALIDATION_ERROR',
  'UNAUTHORIZED',
  'FORBIDDEN',
  'NOT_FOUND',
  'CONFLICT',
  'RATE_LIMITED',
  'INTERNAL_ERROR',
  'INVALID_CREDENTIALS',
  'PIN_LOCKED',
  'SLUG_TAKEN',
  'FEATURE_DISABLED',
  'GALLERY_LIMIT_REACHED',
  'UNSUPPORTED_FILE_TYPE',
  'FILE_TOO_LARGE',
  'FILE_REQUIRED',
  'RSVP_CLOSED',
  'FORM_EXPIRED',
  'SPAM_DETECTED',
  'PHONE_REQUIRED',
  'TOO_MANY_GUESTS',
] as const;

export type ErrorCode = (typeof ERROR_CODES)[number];

export interface ApiErrorIssue {
  path: string;
  code: string;
  message: string;
}

export interface ApiErrorBody {
  statusCode: number;
  code: ErrorCode;
  issues?: ApiErrorIssue[];
  /** Qo'shimcha kontekst (masalan, PIN_LOCKED uchun lockedUntil). */
  details?: Record<string, unknown>;
}
