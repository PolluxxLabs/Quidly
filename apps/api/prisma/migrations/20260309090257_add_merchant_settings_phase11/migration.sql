-- CreateEnum
CREATE TYPE "MerchantEnvironment" AS ENUM ('SANDBOX', 'LIVE');

-- AlterTable
ALTER TABLE "Merchant" ADD COLUMN     "defaultEnvironment" "MerchantEnvironment" NOT NULL DEFAULT 'SANDBOX',
ADD COLUMN     "webhookSecretUpdatedAt" TIMESTAMP(3),
ADD COLUMN     "webhookUrlUpdatedAt" TIMESTAMP(3);
