ALTER TABLE "ConfigProfile" ADD COLUMN "presidioApiKey" TEXT;
ALTER TABLE "ConfigProfile" ADD COLUMN "presidioScoreThreshold" DOUBLE PRECISION;
ALTER TABLE "ConfigProfile" ADD COLUMN "presidioFullPersonNamesOnly" BOOLEAN;
ALTER TABLE "ConfigProfile" ADD COLUMN "presidioDetectPerson" BOOLEAN;
ALTER TABLE "ConfigProfile" ADD COLUMN "presidioDetectEmail" BOOLEAN;
ALTER TABLE "ConfigProfile" ADD COLUMN "presidioDetectPhone" BOOLEAN;
ALTER TABLE "ConfigProfile" ADD COLUMN "presidioDetectLocation" BOOLEAN;
ALTER TABLE "ConfigProfile" ADD COLUMN "presidioDetectIdentifier" BOOLEAN;
