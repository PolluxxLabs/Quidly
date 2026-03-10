-- AlterTable
ALTER TABLE "Merchant" ADD COLUMN     "webhookSecretEncrypted" TEXT,
ADD COLUMN     "webhookSecretHash" TEXT;
