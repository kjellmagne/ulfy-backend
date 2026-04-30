import { afterEach, describe, expect, it, vi } from "vitest";
import { TemplatesService } from "../src/templates/templates.service";

const validYaml = `identity:
  id: 00000000-0000-4000-8000-000000000201
  title: Personlig diktat / logg
  icon: waveform.and.mic
  short_description: Kort strukturert logg.
  category: personlig_diktat
  tags:
    - dictation
    - personal
  language: nb-NO
  version: 1.0.0
context:
  purpose: Create a clear note from the transcript.
  typical_participants:
    - role: speaker
  goals: []
  related_processes: []
perspective:
  voice: third_person
  audience: self
  tone: semi_formell
  style_rules:
    - Do not invent facts.
  preserve_original_voice: false
structure:
  sections:
    - title: Summary
      purpose: Summarize the transcript.
      format: prose
      required: true
      extraction_hints: []
content_rules:
  required_elements: []
  exclusions: []
  uncertainty_handling: Mark unclear information.
  speaker_attribution: none
llm_prompting:
  fallback_behavior: Say when a section was not covered.
  post_processing:
    extract_action_items: true
`;

describe("TemplatesService", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("validates the iOS app YAML schema", () => {
    const service = new TemplatesService({} as any, {} as any);
    const parsed = service.validateYamlContent(validYaml);
    expect(parsed.identity.title).toBe("Personlig diktat / logg");
    expect(parsed.structure.sections[0].title).toBe("Summary");
  });

  it("rejects unsupported root fields", () => {
    const service = new TemplatesService({} as any, {} as any);
    expect(() => service.validateYamlContent(`${validYaml}\nrepository_metadata:\n  tenant: acme\n`)).toThrow();
  });

  it("returns tenant-filtered manifest entries for enterprise activations", async () => {
    const prisma = {
      deviceActivation: {
        findUnique: vi.fn().mockResolvedValue({
          id: "activation-1",
          kind: "enterprise",
          status: "active",
          tenantId: "tenant-1",
          enterpriseLicenseKey: { status: "active", expiresAt: null }
        })
      },
      templateVariant: {
        findMany: vi.fn().mockResolvedValue([
          {
            templateIdentityId: "00000000-0000-4000-8000-000000000201",
            family: { title: "Personlig diktat / logg" },
            publishedVersions: [{ yamlContent: validYaml, publishedAt: new Date("2026-04-29T12:00:00.000Z") }]
          }
        ])
      }
    };
    const service = new TemplatesService(prisma as any, { log: vi.fn() } as any);

    const manifest = await service.manifestForEnterpriseActivation("token-token-token-token");

    expect(manifest.templates).toHaveLength(1);
    expect(manifest.templates[0]).toMatchObject({
      id: "00000000-0000-4000-8000-000000000201",
      title: "Personlig diktat / logg",
      language: "nb-NO",
      download_url: "/api/v1/templates/00000000-0000-4000-8000-000000000201/download"
    });
    expect(prisma.templateVariant.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({
        family: expect.objectContaining({
          OR: [{ isGlobal: true }, { entitlements: { some: { tenantId: "tenant-1" } } }]
        })
      })
    }));
  });

  it("rejects repository access for single-user activations", async () => {
    const prisma = {
      deviceActivation: {
        findUnique: vi.fn().mockResolvedValue({
          id: "activation-1",
          kind: "single",
          status: "active",
          tenantId: null,
          enterpriseLicenseKey: null
        })
      }
    };
    const service = new TemplatesService(prisma as any, { log: vi.fn() } as any);

    await expect(service.manifestForEnterpriseActivation("token-token-token-token")).rejects.toThrow();
  });

  it("normalizes OpenAI preview base URLs to chat completions", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      choices: [{ message: { content: "# Preview\n\nGenerated note." } }]
    }), { status: 200, headers: { "Content-Type": "application/json" } }));
    vi.stubGlobal("fetch", fetchMock);
    const update = vi.fn().mockImplementation(({ data }) => ({
      previewMarkdown: data.previewMarkdown ?? null,
      previewStructured: data.previewStructured ?? null,
      previewProviderType: data.previewProviderType ?? null,
      previewProviderModel: data.previewProviderModel ?? null,
      previewGeneratedAt: data.previewGeneratedAt ?? null,
      previewError: data.previewError ?? null
    }));
    const service = new TemplatesService({
      systemSetting: {
        findUnique: vi.fn().mockResolvedValue({
          value: {
            providerType: "openai",
            endpointUrl: "https://api.openai.com/v1",
            apiKey: "sk-preview",
            model: "gpt-5-mini"
          }
        })
      },
      templateDraft: {
        findUnique: vi.fn().mockResolvedValue({
          id: "draft-1",
          yamlContent: validYaml,
          sampleTranscript: "Speaker: short sample.",
          variant: { family: { title: "Family" } }
        }),
        update
      }
    } as any, { log: vi.fn() } as any);

    const preview = await service.generatePreview("draft-1", { id: "admin-1", email: "admin@example.com" });

    expect(fetchMock).toHaveBeenCalledWith("https://api.openai.com/v1/chat/completions", expect.objectContaining({
      method: "POST",
      headers: expect.objectContaining({ Authorization: "Bearer sk-preview" })
    }));
    expect(preview).toMatchObject({
      markdown: "# Preview\n\nGenerated note.",
      provider: { type: "openai", model: "gpt-5-mini" },
      error: null
    });
  });

  it("reports missing preview provider fields", async () => {
    const service = new TemplatesService({
      systemSetting: {
        findUnique: vi.fn().mockResolvedValue({
          value: { providerType: "openai", endpointUrl: "https://api.openai.com/v1", model: null, apiKey: null }
        })
      }
    } as any, { log: vi.fn() } as any);

    await expect(service.previewProviderStatus()).resolves.toMatchObject({
      configured: false,
      providerType: "openai",
      endpointConfigured: true,
      apiKeyConfigured: false,
      missingFields: ["apiKey", "model"]
    });
  });
});
