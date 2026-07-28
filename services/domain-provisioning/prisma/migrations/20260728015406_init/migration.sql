-- CreateEnum
CREATE TYPE "TenantBillingStatus" AS ENUM ('active', 'suspended', 'cancelled');

-- CreateEnum
CREATE TYPE "DomainVerificationStatus" AS ENUM ('pending', 'verified', 'failed');

-- CreateTable
CREATE TABLE "tenant" (
    "tenant_id" TEXT NOT NULL,
    "tenant_name" TEXT NOT NULL,
    "plan_type" TEXT NOT NULL DEFAULT 'free',
    "billing_status" "TenantBillingStatus" NOT NULL DEFAULT 'active',
    "deactivated_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tenant_pkey" PRIMARY KEY ("tenant_id")
);

-- CreateTable
CREATE TABLE "domain" (
    "domain_id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "domain_name" TEXT NOT NULL,
    "verification_status" "DomainVerificationStatus" NOT NULL DEFAULT 'pending',
    "verification_token" TEXT NOT NULL,
    "verified_at" TIMESTAMP(3),
    "mx_record" TEXT,
    "spf_record" TEXT,
    "dkim_selector" TEXT,
    "dkim_public_key" TEXT,
    "dkim_private_key" TEXT,
    "dmarc_record" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "domain_pkey" PRIMARY KEY ("domain_id")
);

-- CreateIndex
CREATE UNIQUE INDEX "domain_domain_name_key" ON "domain"("domain_name");

-- AddForeignKey
ALTER TABLE "domain" ADD CONSTRAINT "domain_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenant"("tenant_id") ON DELETE RESTRICT ON UPDATE CASCADE;
