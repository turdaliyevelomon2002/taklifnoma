import type { InvitationDraftConfigInput } from '@taklifnoma/shared';
import { ApiError } from '../common/api-error';
import { OwnerInvitationsService } from './owner-invitations.service';

const draftConfig = (): InvitationDraftConfigInput => ({
  version: 1,
  locales: ['uz'],
  defaultLocale: 'uz',
  couple: { groom: { firstName: { uz: 'Ali' } }, bride: { firstName: { uz: 'Madina' } } },
  events: [{ id: 'main', title: { uz: "Nikoh to'yi" }, startsAt: '2027-06-14T18:00:00+05:00', venue: {}, isPrimary: true }],
  rsvp: {},
});

function setup(row: { status?: string; config: unknown }) {
  const prisma = {
    invitation: {
      findUnique: jest.fn().mockResolvedValue({ publishedAt: null, status: 'DRAFT', ...row }),
      update: jest.fn().mockResolvedValue({}),
    },
  };
  const service = new OwnerInvitationsService(
    prisma as never,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
  );
  // get() natijasi bu testlarda muhim emas.
  jest.spyOn(service, 'get').mockResolvedValue({} as never);
  return { service, prisma };
}

async function catchError(promise: Promise<unknown>): Promise<ApiError> {
  try {
    await promise;
  } catch (err) {
    return err as ApiError;
  }
  throw new Error('xato kutilgan edi');
}

describe('OwnerInvitationsService: qoralama va chop etish', () => {
  it("to'yxonasiz qoralamani chop etishni rad etadi va yetishmayotgan maydonlarni qaytaradi", async () => {
    const { service, prisma } = setup({ config: draftConfig() });
    const err = await catchError(service.changeStatus('id', { status: 'ACTIVE' }));
    expect(err).toBeInstanceOf(ApiError);
    expect(err.code).toBe('INVITATION_INCOMPLETE');
    const paths = err.extra?.issues?.map((i) => i.path) ?? [];
    expect(paths).toEqual(
      expect.arrayContaining(['config.events.0.venue.name', 'config.events.0.venue.address', 'config.events.0.venue.location']),
    );
    expect(prisma.invitation.update).not.toHaveBeenCalled();
  });

  it("to'liq config bilan chop etadi", async () => {
    const config = draftConfig();
    config.events[0]!.venue = {
      name: { uz: 'Oqsaroy' },
      address: { uz: 'Toshkent' },
      location: { lat: 41.3, lng: 69.2 },
    };
    const { service, prisma } = setup({ config });
    await service.changeStatus('id', { status: 'ACTIVE' });
    expect(prisma.invitation.update).toHaveBeenCalledTimes(1);
  });

  it('qoralamani arxivlash yoki qoralamada qoldirish uchun tekshirmaydi', async () => {
    const { service, prisma } = setup({ config: draftConfig() });
    await service.changeStatus('id', { status: 'ARCHIVED' });
    expect(prisma.invitation.update).toHaveBeenCalledTimes(1);
  });

  it('chop etilgan taklifnomani chala config bilan saqlab bo\'lmaydi', async () => {
    const { service, prisma } = setup({ status: 'ACTIVE', config: {} });
    const err = await catchError(service.update('id', { config: draftConfig() as never }));
    expect(err.code).toBe('INVITATION_INCOMPLETE');
    expect(prisma.invitation.update).not.toHaveBeenCalled();
  });
});
