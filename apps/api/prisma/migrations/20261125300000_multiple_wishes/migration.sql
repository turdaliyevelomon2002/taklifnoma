-- Bitta mehmon bir nechta tilak yoza oladi: tilaklar alohida jadvalga ko'chadi, har biri muallifga (rsvp) bog'langan.
CREATE TABLE "wishes" (
    "id" UUID NOT NULL,
    "invitationId" UUID NOT NULL,
    "rsvpId" UUID NOT NULL,
    "text" VARCHAR(1000) NOT NULL,
    "status" "WishStatus" NOT NULL DEFAULT 'PENDING',
    "flagged" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "wishes_pkey" PRIMARY KEY ("id")
);

-- Mavjud tilaklar: ID sifatida javob ID'si olinadi, shunda mehmon brauzeridagi va eski
-- Telegram xabarlaridagi (w:a:<id>) havolalar ishlashda davom etadi.
INSERT INTO "wishes" ("id", "invitationId", "rsvpId", "text", "status", "flagged", "createdAt", "updatedAt")
SELECT "id", "invitationId", "id", "wish", "wishStatus", "wishFlagged", "createdAt", "updatedAt"
  FROM "rsvps"
 WHERE "wish" IS NOT NULL;

CREATE INDEX "wishes_invitationId_status_createdAt_idx" ON "wishes"("invitationId", "status", "createdAt");
CREATE INDEX "wishes_rsvpId_createdAt_idx" ON "wishes"("rsvpId", "createdAt");
ALTER TABLE "wishes" ADD CONSTRAINT "wishes_invitationId_fkey" FOREIGN KEY ("invitationId") REFERENCES "invitations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "wishes" ADD CONSTRAINT "wishes_rsvpId_fkey" FOREIGN KEY ("rsvpId") REFERENCES "rsvps"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "notifications"
  ADD COLUMN "wishId" UUID,
  ADD COLUMN "wishOnly" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_wishId_fkey" FOREIGN KEY ("wishId") REFERENCES "wishes"("id") ON DELETE CASCADE ON UPDATE CASCADE;
-- Hali yuborilmagan eski xabarlar tilagini yo'qotmasin.
UPDATE "notifications" n SET "wishId" = n."rsvpId" WHERE EXISTS (SELECT 1 FROM "wishes" w WHERE w."id" = n."rsvpId");

DROP INDEX "rsvps_invitationId_wishStatus_idx";
ALTER TABLE "rsvps" DROP COLUMN "wish", DROP COLUMN "wishStatus", DROP COLUMN "wishFlagged";
