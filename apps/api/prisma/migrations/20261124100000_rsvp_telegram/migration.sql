-- AlterTable
ALTER TABLE "owners" ADD COLUMN     "telegramLinkCode" VARCHAR(32);

-- AlterTable
ALTER TABLE "rsvps" ALTER COLUMN "phone" DROP NOT NULL;

-- AlterTable
ALTER TABLE "notifications" ADD COLUMN     "isUpdate" BOOLEAN NOT NULL DEFAULT false;

-- CreateIndex
CREATE UNIQUE INDEX "owners_telegramLinkCode_key" ON "owners"("telegramLinkCode");

-- CreateIndex
CREATE INDEX "rsvps_invitationId_ipHash_createdAt_idx" ON "rsvps"("invitationId", "ipHash", "createdAt");

