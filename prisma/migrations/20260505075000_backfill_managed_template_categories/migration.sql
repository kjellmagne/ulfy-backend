UPDATE "ConfigProfile"
SET "managedPolicy" = COALESCE("managedPolicy", '{}'::jsonb) || '{"manageTemplateCategories": true}'::jsonb
WHERE "managedPolicy" IS NULL
   OR (
     NOT ("managedPolicy" ? 'manageTemplateCategories')
     AND NOT ("managedPolicy" ? 'templateCategoriesManaged')
   );
