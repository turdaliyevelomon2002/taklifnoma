import { HttpStatus, PipeTransform } from '@nestjs/common';
import type { ZodTypeAny, output } from 'zod';
import { ApiError } from './api-error';

/**
 * Zod sxemasi bilan tekshiradi. Sxemalar packages/shared'da: frontend formalari ham
 * aynan shu qoidalarni ishlatadi.
 *
 *   @Body(new ZodValidationPipe(createInvitationSchema)) body: CreateInvitationInput
 */
export class ZodValidationPipe<T extends ZodTypeAny> implements PipeTransform<unknown, output<T>> {
  constructor(private readonly schema: T) {}

  transform(value: unknown): output<T> {
    const result = this.schema.safeParse(value);
    if (!result.success) {
      throw new ApiError(HttpStatus.BAD_REQUEST, 'VALIDATION_ERROR', {
        issues: result.error.issues.map((issue) => ({
          path: issue.path.join('.'),
          code: issue.code,
          message: issue.message,
        })),
      });
    }
    return result.data;
  }
}
