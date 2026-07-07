-- Paddle billing: renomeia as colunas legadas stripe* e adiciona os campos de
-- período de uso. SQL escrito à mão (sem auto-diff — o banco tem drift
-- conhecido: tabela AudioTrack/colunas originalAudio* fora do schema).

ALTER TABLE "Subscription" RENAME COLUMN "stripeCustomerId" TO "paddleCustomerId";
ALTER TABLE "Subscription" RENAME COLUMN "stripeSubscriptionId" TO "paddleSubscriptionId";

ALTER INDEX "Subscription_stripeCustomerId_key" RENAME TO "Subscription_paddleCustomerId_key";
ALTER INDEX "Subscription_stripeSubscriptionId_key" RENAME TO "Subscription_paddleSubscriptionId_key";

ALTER TABLE "Subscription" ADD COLUMN "paddlePriceId" TEXT;
ALTER TABLE "Subscription" ADD COLUMN "currentPeriodEnd" TIMESTAMP(3);
ALTER TABLE "Subscription" ADD COLUMN "cancelAtPeriodEnd" BOOLEAN NOT NULL DEFAULT false;

-- Nomenclatura antiga de plano ("basic") vira "starter"
UPDATE "Subscription" SET "plan" = 'starter' WHERE "plan" = 'basic';
