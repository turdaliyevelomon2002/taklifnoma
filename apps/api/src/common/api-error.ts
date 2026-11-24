import { HttpException, HttpStatus } from '@nestjs/common';
import type { ApiErrorIssue, ErrorCode } from '@taklifnoma/shared';

/**
 * Barcha biznes xatolar shu klass orqali tashlanadi. Javob tanasi: { statusCode, code, ... }.
 * Frontend `code`ni i18n kalitiga aylantiradi.
 */
export class ApiError extends HttpException {
  constructor(
    status: HttpStatus,
    readonly code: ErrorCode,
    readonly extra?: { issues?: ApiErrorIssue[]; details?: Record<string, unknown> },
  ) {
    super({ statusCode: status, code, ...extra }, status);
  }

  static notFound(): ApiError {
    return new ApiError(HttpStatus.NOT_FOUND, 'NOT_FOUND');
  }

  static unauthorized(code: ErrorCode = 'UNAUTHORIZED'): ApiError {
    return new ApiError(HttpStatus.UNAUTHORIZED, code);
  }

  static badRequest(code: ErrorCode, details?: Record<string, unknown>): ApiError {
    return new ApiError(HttpStatus.BAD_REQUEST, code, details ? { details } : undefined);
  }

  static conflict(code: ErrorCode = 'CONFLICT'): ApiError {
    return new ApiError(HttpStatus.CONFLICT, code);
  }

  static forbidden(code: ErrorCode = 'FORBIDDEN', details?: Record<string, unknown>): ApiError {
    return new ApiError(HttpStatus.FORBIDDEN, code, details ? { details } : undefined);
  }
}
