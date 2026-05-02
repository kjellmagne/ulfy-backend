ALTER TABLE "TemplateCategory" ADD COLUMN "icon" TEXT NOT NULL DEFAULT 'folder';
ALTER TABLE "TemplateCategory" ADD COLUMN "sortOrder" INTEGER NOT NULL DEFAULT 0;

UPDATE "TemplateCategory" SET "icon" = 'waveform.and.mic', "sortOrder" = 10 WHERE "slug" = 'personlig_diktat';
UPDATE "TemplateCategory" SET "icon" = 'person.3.sequence.fill', "sortOrder" = 20 WHERE "slug" = 'avdelingsmote';
UPDATE "TemplateCategory" SET "icon" = 'arrow.triangle.2.circlepath', "sortOrder" = 30 WHERE "slug" = 'oppfolgingssamtale';
UPDATE "TemplateCategory" SET "icon" = 'person.text.rectangle', "sortOrder" = 40 WHERE "slug" = 'jobbintervju';
UPDATE "TemplateCategory" SET "icon" = 'clipboard.fill', "sortOrder" = 50 WHERE "slug" = 'kartleggingssamtale';
