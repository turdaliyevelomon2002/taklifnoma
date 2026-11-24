import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
  PayloadTooLargeException,
} from '@nestjs/common';
import { ThrottlerException } from '@nestjs/throttler';
import { Prisma } from '@prisma/client';
import type { ApiErrorBody, ErrorCode } from '@taklifnoma/shared';
import type { Response } from 'express';

const STATUS_TO_CODE: Partial<Record<number, ErrorCode>> = {
  [HttpStatus.BAD_REQUEST]: 'VALIDATION_ERROR',
  [HttpStatus.UNAUTHORIZED]: 'UNAUTHORIZED',
  [HttpStatus.FORBIDDEN]: 'FORBIDDEN',
  [HttpStatus.NOT_FOUND]: 'NOT_FOUND',
  [HttpStatus.CONFLICT]: 'CONFLICT',
  [HttpStatus.PAYLOAD_TOO_LARGE]: 'FILE_TOO_LARGE',
  [HttpStatus.TOO_MANY_REQUESTS]: 'RATE_LIMITED',
};

/** Barcha xatolarni yagona { statusCode, code } formatiga keltiradi; ichki tafsilotlar sizmaydi. */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger('Exceptions');

  catch(exception: unknown, host: ArgumentsHost): void {
    const res = host.switchToHttp().getResponse<Response>();
    const body = this.toBody(exception);
    if (body.statusCode >= 500) {
      this.logger.error(exception instanceof Error ? exception.stack : String(exception));
    }
    res.status(body.statusCode).json(body);
  }

  private toBody(exception: unknown): ApiErrorBody {
    if (exception instanceof ThrottlerException) {
      return { statusCode: HttpStatus.TOO_MANY_REQUESTS, code: 'RATE_LIMITED' };
    }
    if (exception instanceof PayloadTooLargeException) {
      return { statusCode: HttpStatus.PAYLOAD_TOO_LARGE, code: 'FILE_TOO_LARGE' };
    }
    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const response = exception.getResponse();
      if (typeof response === 'object' && response && 'code' in response) {
        return response as ApiErrorBody;
      }
      return { statusCode: status, code: STATUS_TO_CODE[status] ?? 'INTERNAL_ERROR' };
    }
    if (exception instanceof Prisma.PrismaClientKnownRequestError) {
      if (exception.code === 'P2002') return { statusCode: HttpStatus.CONFLICT, code: 'CONFLICT' };
      if (exception.code === 'P2025') return { statusCode: HttpStatus.NOT_FOUND, code: 'NOT_FOUND' };
    }
    return { statusCode: HttpStatus.INTERNAL_SERVER_ERROR, code: 'INTERNAL_ERROR' };
  }
}
