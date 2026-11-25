-- Tilaklarni oldindan tekshirish: wishHidden (boolean) o'rniga holat + so'kinish filtri belgisi.
CREATE TYPE "WishStatus" AS ENUM ('PENDING', 'APPROVED', 'HIDDEN');

ALTER TABLE "rsvps"
  ADD COLUMN "wishStatus" "WishStatus" NOT NULL DEFAULT 'APPROVED',
  ADD COLUMN "wishFlagged" BOOLEAN NOT NULL DEFAULT false;

-- Mavjud tilaklar: yashirilganlari HIDDEN, qolganlari APPROVED (devordan yo'qolmaydi).
UPDATE "rsvps" SET "wishStatus" = 'HIDDEN' WHERE "wishHidden" = true;

ALTER TABLE "rsvps" DROP COLUMN "wishHidden";

CREATE INDEX "rsvps_invitationId_wishStatus_idx" ON "rsvps"("invitationId", "wishStatus");
