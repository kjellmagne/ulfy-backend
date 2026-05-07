import { createCipheriv, createDecipheriv, randomBytes } from "crypto";
import { configSecretKeyBytes } from "../config/environment";

const ENCRYPTED_PREFIX = "enc:v1";

export function encryptSecret(value?: string | null) {
  if (!value) return value ?? null;
  if (isEncryptedSecret(value)) return value;

  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", configSecretKeyBytes(), iv);
  const encrypted = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [ENCRYPTED_PREFIX, iv.toString("base64url"), tag.toString("base64url"), encrypted.toString("base64url")].join(":");
}

export function decryptSecret(value?: string | null) {
  if (!value) return value ?? null;
  if (!isEncryptedSecret(value)) return value;

  const [, version, ivValue, tagValue, cipherValue] = value.match(/^enc:(v\d+):([^:]+):([^:]+):(.+)$/) ?? [];
  if (version !== "v1" || !ivValue || !tagValue || !cipherValue) {
    throw new Error("Unsupported encrypted secret format.");
  }

  const decipher = createDecipheriv("aes-256-gcm", configSecretKeyBytes(), Buffer.from(ivValue, "base64url"));
  decipher.setAuthTag(Buffer.from(tagValue, "base64url"));
  const decrypted = Buffer.concat([
    decipher.update(Buffer.from(cipherValue, "base64url")),
    decipher.final()
  ]);
  return decrypted.toString("utf8");
}

export function isEncryptedSecret(value?: string | null) {
  return typeof value === "string" && value.startsWith(`${ENCRYPTED_PREFIX}:`);
}

type ConfigSecretFields = {
  speechApiKey?: string | null;
  presidioApiKey?: string | null;
  privacyReviewApiKey?: string | null;
  documentGenerationApiKey?: string | null;
  providerProfiles?: unknown;
};

export function encryptConfigProfileSecrets<T extends ConfigSecretFields>(profile: T): T {
  return {
    ...profile,
    speechApiKey: encryptSecret(profile.speechApiKey),
    presidioApiKey: encryptSecret(profile.presidioApiKey),
    privacyReviewApiKey: encryptSecret(profile.privacyReviewApiKey),
    documentGenerationApiKey: encryptSecret(profile.documentGenerationApiKey),
    providerProfiles: transformNestedApiKeys(profile.providerProfiles, encryptSecret)
  };
}

export function decryptConfigProfileSecrets<T extends ConfigSecretFields>(profile: T): T {
  return {
    ...profile,
    speechApiKey: decryptSecret(profile.speechApiKey),
    presidioApiKey: decryptSecret(profile.presidioApiKey),
    privacyReviewApiKey: decryptSecret(profile.privacyReviewApiKey),
    documentGenerationApiKey: decryptSecret(profile.documentGenerationApiKey),
    providerProfiles: transformNestedApiKeys(profile.providerProfiles, decryptSecret)
  };
}

export function encryptPreviewProviderSetting<T extends { apiKey?: string | null }>(setting: T): T {
  return { ...setting, apiKey: encryptSecret(setting.apiKey) };
}

export function decryptPreviewProviderSetting<T extends { apiKey?: string | null }>(setting: T): T {
  return { ...setting, apiKey: decryptSecret(setting.apiKey) };
}

function transformNestedApiKeys(value: unknown, transform: (input?: string | null) => string | null | undefined): unknown {
  if (Array.isArray(value)) {
    return value.map((item) => transformNestedApiKeys(item, transform));
  }
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([key, nested]) => {
        if (key === "apiKey" && (typeof nested === "string" || nested == null)) {
          return [key, transform(nested)];
        }
        return [key, transformNestedApiKeys(nested, transform)];
      })
    );
  }
  return value;
}
