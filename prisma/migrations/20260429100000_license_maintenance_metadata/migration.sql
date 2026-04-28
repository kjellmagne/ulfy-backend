ALTER TABLE "SingleLicenseKey" ADD COLUMN "maintenanceUntil" TIMESTAMP(3);
ALTER TABLE "EnterpriseLicenseKey" ADD COLUMN "maintenanceUntil" TIMESTAMP(3);

UPDATE "SingleLicenseKey"
SET "maintenanceUntil" = COALESCE("expiresAt", "generatedAt" + INTERVAL '1 year')
WHERE "maintenanceUntil" IS NULL;

UPDATE "EnterpriseLicenseKey"
SET "maintenanceUntil" = COALESCE("expiresAt", "generatedAt" + INTERVAL '1 year')
WHERE "maintenanceUntil" IS NULL;
