ALTER TABLE "Tenant" ADD COLUMN "legalName" TEXT;
ALTER TABLE "Tenant" ADD COLUMN "organizationNumber" TEXT;
ALTER TABLE "Tenant" ADD COLUMN "contactName" TEXT;
ALTER TABLE "Tenant" ADD COLUMN "contactEmail" TEXT;
ALTER TABLE "Tenant" ADD COLUMN "contactPhone" TEXT;
ALTER TABLE "Tenant" ADD COLUMN "billingEmail" TEXT;
ALTER TABLE "Tenant" ADD COLUMN "addressLine1" TEXT;
ALTER TABLE "Tenant" ADD COLUMN "addressLine2" TEXT;
ALTER TABLE "Tenant" ADD COLUMN "postalCode" TEXT;
ALTER TABLE "Tenant" ADD COLUMN "city" TEXT;
ALTER TABLE "Tenant" ADD COLUMN "country" TEXT NOT NULL DEFAULT 'NO';
ALTER TABLE "Tenant" ADD COLUMN "status" TEXT NOT NULL DEFAULT 'active';
ALTER TABLE "Tenant" ADD COLUMN "notes" TEXT;

ALTER TABLE "SingleLicenseKey" ADD COLUMN "deviceSerialNumber" TEXT;
ALTER TABLE "SingleLicenseKey" ADD COLUMN "lastSeenAt" TIMESTAMP(3);

ALTER TABLE "DeviceActivation" ADD COLUMN "deviceSerialNumber" TEXT;
ALTER TABLE "DeviceActivation" ADD COLUMN "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

UPDATE "SingleLicenseKey" SET "lastSeenAt" = "lastCheckIn" WHERE "lastCheckIn" IS NOT NULL;
UPDATE "DeviceActivation" SET "lastSeenAt" = "lastCheckIn" WHERE "lastCheckIn" IS NOT NULL;
