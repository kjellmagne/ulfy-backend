UPDATE "ConfigProfile"
SET "managedPolicy" = COALESCE("managedPolicy", '{}'::jsonb) || '{"managePrivacyPrompt": true}'::jsonb
WHERE "privacyPrompt" IS NOT NULL
  AND btrim("privacyPrompt") <> ''
  AND (
    "managedPolicy" IS NULL
    OR (
      NOT ("managedPolicy" ? 'managePrivacyPrompt')
      AND NOT ("managedPolicy" ? 'privacyPromptManaged')
    )
  );
