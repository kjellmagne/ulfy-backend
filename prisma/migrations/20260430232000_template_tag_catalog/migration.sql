CREATE TABLE "TemplateTag" (
  "id" TEXT NOT NULL,
  "slug" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "color" TEXT NOT NULL DEFAULT '#64748b',
  "description" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "TemplateTag_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "TemplateTag_slug_key" ON "TemplateTag"("slug");
