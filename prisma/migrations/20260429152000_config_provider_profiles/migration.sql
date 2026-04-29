ALTER TABLE "ConfigProfile" ADD COLUMN "providerProfiles" JSONB NOT NULL DEFAULT '{}';
ALTER TABLE "ConfigProfile" ADD COLUMN "managedPolicy" JSONB NOT NULL DEFAULT '{}';
