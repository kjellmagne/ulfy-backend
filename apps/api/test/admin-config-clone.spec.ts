import { describe, expect, it, vi } from "vitest";
import { AdminController } from "../src/admin/admin.controller";

describe("AdminController config cloning", () => {
  it("copies managed policy fields into a new config profile", async () => {
    const source = {
      id: "profile-1",
      name: "Strict enterprise policy",
      description: "Locked provider setup",
      partnerId: "partner-1",
      speechProviderType: "openai",
      speechEndpointUrl: "https://speech.example.internal/v1",
      speechModelName: "gpt-4o-transcribe",
      speechApiKey: "speech-key",
      privacyControlEnabled: true,
      piiControlEnabled: true,
      presidioEndpointUrl: "https://presidio.example.internal",
      presidioSecretRef: "secret://ulfy/presidio",
      presidioApiKey: "presidio-key",
      presidioScoreThreshold: 0.35,
      presidioFullPersonNamesOnly: true,
      presidioDetectPerson: true,
      presidioDetectEmail: true,
      presidioDetectPhone: true,
      presidioDetectLocation: true,
      presidioDetectIdentifier: true,
      privacyReviewProviderType: "openai_compatible",
      privacyReviewEndpointUrl: "https://privacy.example.internal/v1/chat/completions",
      privacyReviewModel: "privacy-review-v1",
      privacyReviewApiKey: "privacy-key",
      privacyPrompt: "Check for sensitive details before document generation.",
      documentGenerationProviderType: "openai_compatible",
      documentGenerationEndpointUrl: "https://llm.example.internal/v1",
      documentGenerationModel: "ulfy-docgen",
      documentGenerationApiKey: "docgen-key",
      templateRepositoryUrl: "https://kvasetech.com/backend/api/v1/templates/manifest",
      telemetryEndpointUrl: "https://telemetry.example.internal/events",
      featureFlags: { developerMode: false },
      allowedProviderRestrictions: ["openai_compatible"],
      providerProfiles: { formatter: { privacyEmphasis: "managed" } },
      managedPolicy: { allowPolicyOverride: false, hideSettings: true },
      defaultTemplateId: null,
      createdAt: new Date("2026-04-29T10:00:00.000Z"),
      updatedAt: new Date("2026-04-29T10:00:00.000Z")
    };
    const created = { ...source, id: "profile-2", name: "Copy of Strict enterprise policy" };
    const prisma = {
      configProfile: {
        findFirst: vi.fn().mockResolvedValue(source),
        create: vi.fn().mockResolvedValue(created)
      }
    };
    const audit = { log: vi.fn().mockResolvedValue(undefined) };
    const controller = new AdminController(prisma as any, audit as any, {} as any);
    const normalizedManagedPolicy = {
      allowPolicyOverride: false,
      hideSettings: true,
      managePrivacyControl: true,
      userMayChangePrivacyControl: false,
      managePIIControl: true,
      userMayChangePIIControl: false,
      managePrivacyReviewProvider: true,
      userMayChangePrivacyReviewProvider: false,
      managePrivacyPrompt: true,
      manageTemplateCategories: true
    };

    const result = await controller.cloneConfig("profile-1", {}, { user: { sub: "admin-1", email: "admin@example.com", role: "superadmin" } });

    expect(result).toEqual({
      ...created,
      managedPolicy: normalizedManagedPolicy,
      speechApiKey: "********",
      presidioApiKey: "********",
      documentGenerationApiKey: "********",
      privacyReviewApiKey: "********"
    });
    expect(prisma.configProfile.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        name: "Copy of Strict enterprise policy",
        speechApiKey: "speech-key",
        presidioApiKey: "presidio-key",
        presidioScoreThreshold: 0.35,
        presidioFullPersonNamesOnly: true,
        presidioDetectPerson: true,
        presidioDetectEmail: true,
        privacyReviewApiKey: "privacy-key",
        privacyPrompt: "Check for sensitive details before document generation.",
        documentGenerationApiKey: "docgen-key",
        managedPolicy: normalizedManagedPolicy
      }),
      include: { partner: true }
    });
    expect(prisma.configProfile.create.mock.calls[0][0].data).not.toHaveProperty("id");
    expect(prisma.configProfile.create.mock.calls[0][0].data).not.toHaveProperty("createdAt");
    expect(prisma.configProfile.create.mock.calls[0][0].data).not.toHaveProperty("updatedAt");
    expect(audit.log).toHaveBeenCalledWith(expect.objectContaining({
      action: "config.clone",
      targetType: "ConfigProfile",
      targetId: "profile-2",
      metadata: { sourceConfigProfileId: "profile-1" }
    }));
  });
});
