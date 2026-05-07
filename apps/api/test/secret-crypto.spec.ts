import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  decryptConfigProfileSecrets,
  decryptPreviewProviderSetting,
  encryptConfigProfileSecrets,
  encryptPreviewProviderSetting,
  isEncryptedSecret
} from "../src/common/secret-crypto";

describe("secret-crypto", () => {
  beforeEach(() => {
    vi.stubEnv("DATABASE_URL", "postgresql://test:test@localhost:5432/test?schema=public");
    vi.stubEnv("JWT_SECRET", "j".repeat(64));
    vi.stubEnv("ACTIVATION_TOKEN_SECRET", "a".repeat(64));
    vi.stubEnv("CONFIG_SECRET_KEY", Buffer.alloc(32, 21).toString("base64"));
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("encrypts and decrypts config profile secrets, including nested provider profiles", () => {
    const original = {
      speechApiKey: "speech-secret",
      presidioApiKey: "presidio-secret",
      privacyReviewApiKey: "privacy-secret",
      documentGenerationApiKey: "docgen-secret",
      providerProfiles: {
        formatter: {
          providers: [
            { id: "docgen", apiKey: "provider-secret" }
          ]
        }
      }
    };

    const encrypted = encryptConfigProfileSecrets(original);

    expect(isEncryptedSecret(encrypted.speechApiKey)).toBe(true);
    expect(isEncryptedSecret((encrypted.providerProfiles as any).formatter.providers[0].apiKey)).toBe(true);
    expect(decryptConfigProfileSecrets(encrypted)).toEqual(original);
  });

  it("encrypts and decrypts the template preview provider setting", () => {
    const original = {
      providerType: "openai_compatible",
      endpoint: "https://llm.example.internal/v1",
      apiKey: "preview-secret",
      model: "skrivdet-preview"
    };

    const encrypted = encryptPreviewProviderSetting(original);

    expect(isEncryptedSecret(encrypted.apiKey)).toBe(true);
    expect(decryptPreviewProviderSetting(encrypted)).toEqual(original);
  });
});
