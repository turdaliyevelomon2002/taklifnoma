-- Mini App orqali kirgan mehmonni Telegram akkaunti bo'yicha tanish.
ALTER TABLE "rsvps"
  ADD COLUMN "telegramUserId" BIGINT,
  ADD COLUMN "telegramUsername" VARCHAR(64);

-- NULL qiymatlar takrorlanishi mumkin (brauzer orqali javoblar), Telegram ID esa taklifnoma ichida yagona.
CREATE UNIQUE INDEX "rsvps_invitationId_telegramUserId_key" ON "rsvps"("invitationId", "telegramUserId");
