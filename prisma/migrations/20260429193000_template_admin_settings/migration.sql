CREATE TABLE "TemplateSectionPreset" (
  "id" TEXT NOT NULL,
  "slug" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "purpose" TEXT NOT NULL,
  "format" TEXT NOT NULL DEFAULT 'prose',
  "required" BOOLEAN NOT NULL DEFAULT false,
  "extractionHints" JSONB NOT NULL DEFAULT '[]',
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "TemplateSectionPreset_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "TemplateSectionPreset_slug_key" ON "TemplateSectionPreset"("slug");
