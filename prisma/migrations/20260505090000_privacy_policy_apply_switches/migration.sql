UPDATE "ConfigProfile"
SET "managedPolicy" = COALESCE("managedPolicy", '{}'::jsonb) || '{"managePrivacyControl": true}'::jsonb
WHERE "privacyControlEnabled" IS NOT NULL
  AND (
    "managedPolicy" IS NULL
    OR (
      NOT ("managedPolicy" ? 'managePrivacyControl')
      AND NOT ("managedPolicy" ? 'privacyControlManaged')
    )
  );

UPDATE "ConfigProfile"
SET "managedPolicy" = COALESCE("managedPolicy", '{}'::jsonb) || '{"managePIIControl": true}'::jsonb
WHERE (
    "piiControlEnabled" IS NOT NULL
    OR ("presidioEndpointUrl" IS NOT NULL AND btrim("presidioEndpointUrl") <> '')
    OR ("presidioSecretRef" IS NOT NULL AND btrim("presidioSecretRef") <> '')
    OR ("presidioApiKey" IS NOT NULL AND btrim("presidioApiKey") <> '')
    OR "presidioScoreThreshold" IS NOT NULL
    OR "presidioFullPersonNamesOnly" IS NOT NULL
    OR "presidioDetectPerson" IS NOT NULL
    OR "presidioDetectEmail" IS NOT NULL
    OR "presidioDetectPhone" IS NOT NULL
    OR "presidioDetectLocation" IS NOT NULL
    OR "presidioDetectIdentifier" IS NOT NULL
  )
  AND (
    "managedPolicy" IS NULL
    OR (
      NOT ("managedPolicy" ? 'managePIIControl')
      AND NOT ("managedPolicy" ? 'piiControlManaged')
    )
  );

UPDATE "ConfigProfile"
SET "managedPolicy" = COALESCE("managedPolicy", '{}'::jsonb) || '{"managePrivacyReviewProvider": true}'::jsonb
WHERE (
    ("privacyReviewProviderType" IS NOT NULL AND btrim("privacyReviewProviderType") <> '')
    OR ("privacyReviewEndpointUrl" IS NOT NULL AND btrim("privacyReviewEndpointUrl") <> '')
    OR ("privacyReviewModel" IS NOT NULL AND btrim("privacyReviewModel") <> '')
    OR ("privacyReviewApiKey" IS NOT NULL AND btrim("privacyReviewApiKey") <> '')
  )
  AND (
    "managedPolicy" IS NULL
    OR (
      NOT ("managedPolicy" ? 'managePrivacyReviewProvider')
      AND NOT ("managedPolicy" ? 'privacyReviewProviderManaged')
      AND NOT ("managedPolicy" ? 'managePrivacyReview')
    )
  );
