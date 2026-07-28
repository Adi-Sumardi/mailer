-- CreateEnum
CREATE TYPE "CredentialEnvironment" AS ENUM ('sandbox', 'production');

-- CreateTable
CREATE TABLE "api_credential" (
    "credential_id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "environment" "CredentialEnvironment" NOT NULL DEFAULT 'sandbox',
    "member_id" TEXT NOT NULL,
    "secret_hash" TEXT NOT NULL,
    "daily_email_limit" INTEGER NOT NULL,
    "emails_sent_today" INTEGER NOT NULL DEFAULT 0,
    "quota_reset_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revoked_at" TIMESTAMP(3),

    CONSTRAINT "api_credential_pkey" PRIMARY KEY ("credential_id")
);

-- CreateIndex
CREATE UNIQUE INDEX "api_credential_member_id_key" ON "api_credential"("member_id");
