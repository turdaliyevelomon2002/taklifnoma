import {
  Body,
  Controller,
  Delete,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  MEDIA_LIMITS,
  mediaKindParamSchema,
  reorderMediaSchema,
  type MediaKind,
  type MediaView,
  type ReorderMediaInput,
} from '@taklifnoma/shared';
import { memoryStorage } from 'multer';
import { OwnerGuard } from '../auth/owner/owner.guard';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { MediaService } from './media.service';

const uuid = new ParseUUIDPipe({ version: '4' });

@Controller('owner/invitations/:invitationId/media')
@UseGuards(OwnerGuard)
export class MediaController {
  constructor(private readonly media: MediaService) {}

  /** multipart/form-data, maydon nomi: "file". kind: cover | gallery | music | og-image */
  @Post(':kind')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: {
        files: 1,
        fileSize: Math.max(MEDIA_LIMITS.imageMaxBytes, MEDIA_LIMITS.audioMaxBytes),
      },
    }),
  )
  upload(
    @Param('invitationId', uuid) invitationId: string,
    @Param('kind', new ZodValidationPipe(mediaKindParamSchema)) kind: MediaKind,
    @UploadedFile() file?: Express.Multer.File,
  ): Promise<MediaView> {
    return this.media.upload(invitationId, kind, file);
  }

  @Patch('gallery/order')
  reorder(
    @Param('invitationId', uuid) invitationId: string,
    @Body(new ZodValidationPipe(reorderMediaSchema)) body: ReorderMediaInput,
  ): Promise<MediaView[]> {
    return this.media.reorder(invitationId, body.ids);
  }

  @Delete(':mediaId')
  @HttpCode(204)
  remove(
    @Param('invitationId', uuid) invitationId: string,
    @Param('mediaId', uuid) mediaId: string,
  ): Promise<void> {
    return this.media.remove(invitationId, mediaId);
  }
}
