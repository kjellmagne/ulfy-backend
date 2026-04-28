ALTER TABLE "ConfigProfile" ADD COLUMN "partnerId" TEXT;

ALTER TABLE "ConfigProfile" ADD CONSTRAINT "ConfigProfile_partnerId_fkey" FOREIGN KEY ("partnerId") REFERENCES "Partner"("id") ON DELETE SET NULL ON UPDATE CASCADE;
