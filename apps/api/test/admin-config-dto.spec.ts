import { ValidationPipe } from "@nestjs/common";
import { describe, expect, it } from "vitest";
import { ConfigDto } from "../src/admin/admin.controller";

describe("ConfigDto", () => {
  it("keeps managed app settings when Nest whitelist validation is enabled", async () => {
    const pipe = new ValidationPipe({ whitelist: true, transform: true });
    const payload = {
      name: "Alta policy",
      description: "Enterprise managed settings",
      speechProviderType: "azure",
      speechEndpointUrl: "http://192.168.222.171:5000",
      speechModelName: null,
      speechApiKey: "speech-key",
      privacyControlEnabled: true,
      piiControlEnabled: true,
      presidioEndpointUrl: "https://presidio.example.internal",
      presidioSecretRef: "secret://ulfy/presidio",
      privacyReviewProviderType: "local_heuristic",
      privacyReviewEndpointUrl: null,
      privacyReviewModel: null,
      documentGenerationProviderType: "openai_compatible",
      documentGenerationEndpointUrl: "https://llm.example.internal/v1",
      documentGenerationModel: "ulfy-docgen",
      documentGenerationApiKey: "docgen-key",
      templateRepositoryUrl: "https://kvasetech.com/backend/api/v1/templates/manifest",
      telemetryEndpointUrl: "https://telemetry.example.internal/events",
      featureFlags: { developerMode: true, allowExternalProviders: false },
      allowedProviderRestrictions: ["openai_compatible"],
      providerProfiles: { presidio: { scoreThreshold: 0.75, detectEmail: true } },
      managedPolicy: { allowPolicyOverride: false, hideSettings: true, userMayChangeSpeechProvider: false, externalFormattersAllowed: true },
      defaultTemplateId: null,
      shouldBeStripped: "not allowed"
    };

    const result = await pipe.transform(payload, { type: "body", metatype: ConfigDto, data: "" });

    expect(result).toMatchObject({
      name: "Alta policy",
      description: "Enterprise managed settings",
      speechProviderType: "azure",
      speechEndpointUrl: "http://192.168.222.171:5000",
      speechApiKey: "speech-key",
      privacyControlEnabled: true,
      piiControlEnabled: true,
      presidioEndpointUrl: "https://presidio.example.internal",
      presidioSecretRef: "secret://ulfy/presidio",
      privacyReviewProviderType: "local_heuristic",
      documentGenerationProviderType: "openai_compatible",
      documentGenerationEndpointUrl: "https://llm.example.internal/v1",
      documentGenerationModel: "ulfy-docgen",
      documentGenerationApiKey: "docgen-key",
      templateRepositoryUrl: "https://kvasetech.com/backend/api/v1/templates/manifest",
      telemetryEndpointUrl: "https://telemetry.example.internal/events",
      featureFlags: { developerMode: true, allowExternalProviders: false },
      allowedProviderRestrictions: ["openai_compatible"],
      providerProfiles: { presidio: { scoreThreshold: 0.75, detectEmail: true } },
      managedPolicy: { allowPolicyOverride: false, hideSettings: true, userMayChangeSpeechProvider: false, externalFormattersAllowed: true },
      defaultTemplateId: null
    });
    expect(result).not.toHaveProperty("shouldBeStripped");
  });
});
