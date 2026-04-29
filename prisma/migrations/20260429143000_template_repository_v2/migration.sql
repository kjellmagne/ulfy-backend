CREATE TABLE "TemplateFamily" (
  "id" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "shortDescription" TEXT NOT NULL,
  "categoryId" TEXT,
  "icon" TEXT NOT NULL DEFAULT 'doc.text',
  "tags" JSONB NOT NULL DEFAULT '[]',
  "isGlobal" BOOLEAN NOT NULL DEFAULT false,
  "state" "TemplateState" NOT NULL DEFAULT 'draft',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "TemplateFamily_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "TemplateVariant" (
  "id" TEXT NOT NULL,
  "familyId" TEXT NOT NULL,
  "language" TEXT NOT NULL,
  "templateIdentityId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "TemplateVariant_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "TemplateDraft" (
  "id" TEXT NOT NULL,
  "variantId" TEXT NOT NULL,
  "yamlContent" TEXT NOT NULL,
  "sampleTranscript" TEXT,
  "previewMarkdown" TEXT,
  "previewStructured" JSONB,
  "previewProviderType" TEXT,
  "previewProviderModel" TEXT,
  "previewGeneratedAt" TIMESTAMP(3),
  "previewError" TEXT,
  "createdByAdminId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "TemplateDraft_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PublishedTemplateVersion" (
  "id" TEXT NOT NULL,
  "variantId" TEXT NOT NULL,
  "version" TEXT NOT NULL,
  "yamlContent" TEXT NOT NULL,
  "createdByAdminId" TEXT,
  "publishedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PublishedTemplateVersion_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "TenantTemplateEntitlement" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "familyId" TEXT NOT NULL,
  "createdByAdminId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "TenantTemplateEntitlement_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "TemplateVariant_templateIdentityId_key" ON "TemplateVariant"("templateIdentityId");
CREATE UNIQUE INDEX "TemplateVariant_familyId_language_key" ON "TemplateVariant"("familyId", "language");
CREATE UNIQUE INDEX "TemplateDraft_variantId_key" ON "TemplateDraft"("variantId");
CREATE UNIQUE INDEX "PublishedTemplateVersion_variantId_version_key" ON "PublishedTemplateVersion"("variantId", "version");
CREATE UNIQUE INDEX "TenantTemplateEntitlement_tenantId_familyId_key" ON "TenantTemplateEntitlement"("tenantId", "familyId");

ALTER TABLE "TemplateFamily" ADD CONSTRAINT "TemplateFamily_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "TemplateCategory"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "TemplateVariant" ADD CONSTRAINT "TemplateVariant_familyId_fkey" FOREIGN KEY ("familyId") REFERENCES "TemplateFamily"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TemplateDraft" ADD CONSTRAINT "TemplateDraft_variantId_fkey" FOREIGN KEY ("variantId") REFERENCES "TemplateVariant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PublishedTemplateVersion" ADD CONSTRAINT "PublishedTemplateVersion_variantId_fkey" FOREIGN KEY ("variantId") REFERENCES "TemplateVariant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TenantTemplateEntitlement" ADD CONSTRAINT "TenantTemplateEntitlement_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TenantTemplateEntitlement" ADD CONSTRAINT "TenantTemplateEntitlement_familyId_fkey" FOREIGN KEY ("familyId") REFERENCES "TemplateFamily"("id") ON DELETE CASCADE ON UPDATE CASCADE;
