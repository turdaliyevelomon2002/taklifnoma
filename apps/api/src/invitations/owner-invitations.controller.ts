import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  changeStatusSchema,
  createInvitationSchema,
  listInvitationsQuerySchema,
  slugCheckQuerySchema,
  updateInvitationSchema,
  type ChangeStatusInput,
  type CoupleAccessCredentials,
  type CreateInvitationInput,
  type CreateInvitationResult,
  type InvitationDetail,
  type InvitationListItem,
  type ListInvitationsQuery,
  type Paginated,
  type PublicInvitation,
  type UpdateInvitationInput,
} from '@taklifnoma/shared';
import { OwnerGuard } from '../auth/owner/owner.guard';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { OwnerInvitationsService } from './owner-invitations.service';

const uuid = new ParseUUIDPipe({ version: '4' });

@Controller('owner/invitations')
@UseGuards(OwnerGuard)
export class OwnerInvitationsController {
  constructor(private readonly service: OwnerInvitationsService) {}

  @Get()
  list(
    @Query(new ZodValidationPipe(listInvitationsQuerySchema)) query: ListInvitationsQuery,
  ): Promise<Paginated<InvitationListItem>> {
    return this.service.list(query);
  }

  @Get('slug-check')
  async slugCheck(
    @Query(new ZodValidationPipe(slugCheckQuerySchema)) query: { slug: string },
  ): Promise<{ available: boolean }> {
    return { available: await this.service.isSlugAvailable(query.slug) };
  }

  @Post()
  create(
    @Body(new ZodValidationPipe(createInvitationSchema)) body: CreateInvitationInput,
  ): Promise<CreateInvitationResult> {
    return this.service.create(body);
  }

  @Get(':id')
  get(@Param('id', uuid) id: string): Promise<InvitationDetail> {
    return this.service.get(id);
  }

  /** Qoralama holatidagi taklifnomani mehmon ko'rinishida ko'rish. */
  @Get(':id/preview')
  preview(@Param('id', uuid) id: string): Promise<PublicInvitation> {
    return this.service.preview(id);
  }

  @Patch(':id')
  update(
    @Param('id', uuid) id: string,
    @Body(new ZodValidationPipe(updateInvitationSchema)) body: UpdateInvitationInput,
  ): Promise<InvitationDetail> {
    return this.service.update(id, body);
  }

  @Post(':id/status')
  @HttpCode(200)
  changeStatus(
    @Param('id', uuid) id: string,
    @Body(new ZodValidationPipe(changeStatusSchema)) body: ChangeStatusInput,
  ): Promise<InvitationDetail> {
    return this.service.changeStatus(id, body);
  }

  @Post(':id/access/regenerate')
  @HttpCode(200)
  regenerateAccess(@Param('id', uuid) id: string): Promise<CoupleAccessCredentials> {
    return this.service.regenerateAccess(id);
  }

  @Delete(':id')
  @HttpCode(204)
  remove(@Param('id', uuid) id: string): Promise<void> {
    return this.service.remove(id);
  }
}
