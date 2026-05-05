ALTER TABLE "ConfigProfile" ALTER COLUMN "privacyControlEnabled" DROP DEFAULT;
ALTER TABLE "ConfigProfile" ALTER COLUMN "privacyControlEnabled" DROP NOT NULL;
ALTER TABLE "ConfigProfile" ALTER COLUMN "piiControlEnabled" DROP DEFAULT;
ALTER TABLE "ConfigProfile" ALTER COLUMN "piiControlEnabled" DROP NOT NULL;
