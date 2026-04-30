import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException, UnauthorizedException } from "@nestjs/common";
import * as yaml from "js-yaml";
import { randomUUID } from "crypto";
import { z } from "zod";
import { PrismaService } from "../prisma/prisma.service";
import { AuditService } from "../common/audit.service";
import { mobileError } from "../activation/activation.service";
import { tokenHash } from "../common/crypto";

const SemverSchema = z.string().regex(/^\d+\.\d+\.\d+$/, "identity.version must use semver x.y.z, such as 1.0.0.");
const TEMPLATE_PREVIEW_PROVIDER_SETTING_KEY = "templatePreviewProvider";

export const AppTemplateYamlSchema = z.object({
  identity: z.object({
    id: z.string().uuid(),
    title: z.string().trim().min(1).max(80),
    icon: z.string().trim().min(1).optional().nullable(),
    short_description: z.string().max(200).optional().nullable(),
    category: z.string().trim().min(1),
    tags: z.array(z.string()).default([]),
    language: z.string().trim().min(2),
    version: SemverSchema
  }).strict(),
  context: z.object({
    purpose: z.string().trim().min(1),
    typical_setting: z.string().optional().nullable(),
    typical_participants: z.array(z.object({
      role: z.string().trim().min(1),
      name: z.string().optional().nullable()
    }).strict()).default([]).optional(),
    goals: z.array(z.string()).default([]).optional(),
    related_processes: z.array(z.string()).default([]).optional()
  }).strict(),
  perspective: z.object({
    voice: z.string().optional().nullable(),
    audience: z.string().optional().nullable(),
    tone: z.string().optional().nullable(),
    style_rules: z.array(z.string()).default([]).optional(),
    preserve_original_voice: z.boolean().optional()
  }).strict(),
  structure: z.object({
    sections: z.array(z.object({
      title: z.string().trim().min(1),
      purpose: z.string().trim().min(1),
      format: z.string().optional().nullable(),
      required: z.boolean().optional(),
      extraction_hints: z.array(z.string()).default([]).optional()
    }).strict()).min(1)
  }).strict(),
  content_rules: z.object({
    required_elements: z.array(z.string()).default([]).optional(),
    exclusions: z.array(z.string()).default([]).optional(),
    uncertainty_handling: z.string().optional().nullable(),
    action_item_format: z.string().optional().nullable(),
    decision_marker: z.string().optional().nullable(),
    speaker_attribution: z.string().optional().nullable()
  }).strict(),
  llm_prompting: z.object({
    system_prompt_additions: z.string().optional().nullable(),
    fallback_behavior: z.string().optional().nullable(),
    post_processing: z.object({
      extract_action_items: z.boolean().optional(),
      structured_output: z.record(z.any()).optional()
    }).strict().default({}).optional()
  }).strict()
}).strict();

type AppTemplateYaml = z.infer<typeof AppTemplateYamlSchema>;
type PublishBump = "patch" | "minor" | "major";

@Injectable()
export class TemplatesService {
  constructor(private readonly prisma: PrismaService, private readonly audit: AuditService) {}

  async manifest(tenantId?: string) {
    const templates = await this.prisma.template.findMany({
      where: {
        state: "published",
        OR: [{ tenantId: null }, ...(tenantId ? [{ tenantId }] : [])]
      },
      include: { category: true, versions: true },
      orderBy: [{ updatedAt: "desc" }]
    });

    return {
      name: tenantId ? "Enterprise Templates" : "Ulfy Templates",
      templates: templates
        .map((template) => {
          const version = template.versions.find((item) => item.id === template.publishedVersionId) ?? template.versions.find((item) => item.state === "published");
          if (!version) return null;
          const metadata = this.metadataFromYaml(version.yamlContent);
          return {
            id: metadata.id,
            title: metadata.title,
            short_description: metadata.shortDescription,
            category: metadata.category,
            language: metadata.language,
            version: metadata.version,
            icon: metadata.icon,
            tags: metadata.tags,
            download_url: `/api/v1/templates/${metadata.id}/download`,
            updated_at: template.updatedAt.toISOString()
          };
        })
        .filter(Boolean)
    };
  }

  async manifestForEnterpriseActivation(activationToken: string) {
    const activation = await this.assertEnterpriseTemplateActivation(activationToken);
    const variants = await this.entitledPublishedVariants(activation.tenantId);
    return this.manifestFromVariants(variants, "Enterprise Templates");
  }

  async manifestForInternalApiKey(apiKey: string) {
    this.assertRepositoryApiKey(apiKey);
    const variants = await this.prisma.templateVariant.findMany({
      where: { family: { state: { not: "archived" } }, publishedVersions: { some: {} } },
      include: this.variantManifestInclude(),
      orderBy: [{ family: { title: "asc" } }, { language: "asc" }]
    });
    return this.manifestFromVariants(variants, "Ulfy Templates");
  }

  async downloadYaml(id: string) {
    const template = await this.prisma.template.findUnique({ where: { id }, include: { versions: true } });
    if (template?.state === "published") {
      const version = template.versions.find((item) => item.id === template.publishedVersionId) ?? template.versions.find((item) => item.state === "published");
      if (!version) throw new NotFoundException("Published template version not found");
      return version.yamlContent;
    }

    const variant = await this.prisma.templateVariant.findFirst({
      where: { OR: [{ id }, { templateIdentityId: id }], family: { state: { not: "archived" } } },
      include: { publishedVersions: { orderBy: [{ publishedAt: "desc" }, { createdAt: "desc" }] } }
    });
    const latest = variant?.publishedVersions[0];
    if (!latest) throw new NotFoundException("Template not found");
    return latest.yamlContent;
  }

  async downloadYamlForEnterpriseActivation(id: string, activationToken: string) {
    const activation = await this.assertEnterpriseTemplateActivation(activationToken);
    const variant = await this.prisma.templateVariant.findFirst({
      where: {
        OR: [{ id }, { templateIdentityId: id }],
        family: {
          state: { not: "archived" },
          OR: [{ isGlobal: true }, { entitlements: { some: { tenantId: activation.tenantId } } }]
        }
      },
      include: { publishedVersions: { orderBy: [{ publishedAt: "desc" }, { createdAt: "desc" }] } }
    });
    const latest = variant?.publishedVersions[0];
    if (!latest) throw new NotFoundException(mobileError("template_not_found", "Template not found or not assigned to this tenant"));
    return latest.yamlContent;
  }

  async downloadYamlForInternalApiKey(id: string, apiKey: string) {
    this.assertRepositoryApiKey(apiKey);
    return this.downloadYaml(id);
  }

  validateYamlContent(yamlContent: string) {
    let parsed: unknown;
    try {
      parsed = yaml.load(yamlContent);
    } catch (error) {
      throw new BadRequestException(`Invalid YAML: ${(error as Error).message}`);
    }
    const result = AppTemplateYamlSchema.safeParse(parsed);
    if (!result.success) throw new BadRequestException({ message: "Template schema validation failed", issues: result.error.issues });
    return result.data;
  }

  metadataFromYaml(yamlContent: string) {
    const template = this.validateYamlContent(yamlContent);
    return {
      id: template.identity.id,
      title: template.identity.title,
      shortDescription: template.identity.short_description ?? template.identity.title,
      category: template.identity.category,
      language: template.identity.language,
      version: template.identity.version,
      icon: template.identity.icon ?? "doc.text",
      tags: template.identity.tags ?? []
    };
  }

  yamlWithVersion(yamlContent: string, version: string) {
    const parsed = this.validateYamlContent(yamlContent) as AppTemplateYaml;
    parsed.identity.version = version;
    return yaml.dump(parsed, { lineWidth: -1, noRefs: true, sortKeys: false });
  }

  buildAssistedDraft(input: { useCase: string; language?: string; category?: string; title?: string; icon?: string }) {
    const title = input.title?.trim() || this.titleFromUseCase(input.useCase);
    const category = input.category?.trim() || "annet";
    const language = input.language?.trim() || "nb-NO";
    const sampleTranscript = [
      "Deltaker 1: Vi starter med kort bakgrunn og hovedpunkter.",
      "Deltaker 2: Det viktigste er at tiltakene blir tydelige og fulgt opp.",
      "Deltaker 1: Ansvarlig person og frist bør fremkomme i notatet."
    ].join("\n");
    const yamlContent = this.createYaml({
      id: randomUUID(),
      title,
      shortDescription: `AI-assistert utkast for ${title}.`,
      category,
      language,
      icon: input.icon || "doc.text",
      tags: ["ai-assist", TemplateSlug(category)],
      purpose: `Create a clear, structured document for: ${input.useCase}`,
      sections: [
        { title: "Sammendrag", purpose: "Summarize the most important context and conclusions.", format: "prose", required: true },
        { title: "Viktige punkter", purpose: "List important observations, decisions, or facts from the transcript.", format: "bullet_list", required: true },
        { title: "Oppfølging", purpose: "List concrete follow-up items with owner and deadline when available.", format: "bullet_list", required: false }
      ]
    });
    return { yamlContent, sampleTranscript, metadata: this.metadataFromYaml(yamlContent) };
  }

  async publishVariantDraft(variantId: string, input: { bump?: PublishBump; version?: string }, actor?: { id?: string; email?: string }) {
    const variant = await this.prisma.templateVariant.findUnique({
      where: { id: variantId },
      include: {
        family: true,
        draft: true,
        publishedVersions: { orderBy: [{ publishedAt: "desc" }, { createdAt: "desc" }] }
      }
    });
    if (!variant?.draft) throw new NotFoundException("Template draft not found");

    const current = this.validateYamlContent(variant.draft.yamlContent);
    const version = input.version?.trim() || (variant.publishedVersions[0] ? this.bumpVersion(variant.publishedVersions[0].version, input.bump ?? "patch") : current.identity.version);
    if (!SemverSchema.safeParse(version).success) throw new BadRequestException("Publish version must use semver x.y.z.");
    const yamlContent = this.yamlWithVersion(variant.draft.yamlContent, version);
    const metadata = this.metadataFromYaml(yamlContent);

    const existing = await this.prisma.publishedTemplateVersion.findUnique({ where: { variantId_version: { variantId, version } } });
    if (existing) throw new ConflictException(`Version ${version} is already published for this variant.`);

    const published = await this.prisma.$transaction(async (tx) => {
      await tx.templateVariant.update({
        where: { id: variantId },
        data: { language: metadata.language, templateIdentityId: metadata.id }
      });
      await tx.templateDraft.update({ where: { id: variant.draft!.id }, data: { yamlContent, previewError: null } });
      await tx.templateFamily.update({
        where: { id: variant.familyId },
        data: {
          title: metadata.title,
          shortDescription: metadata.shortDescription,
          icon: metadata.icon,
          tags: metadata.tags,
          state: "published"
        }
      });
      return tx.publishedTemplateVersion.create({
        data: { variantId, version, yamlContent, createdByAdminId: actor?.id }
      });
    });

    await this.audit.log({ actorAdminId: actor?.id, actorEmail: actor?.email, action: "template.variant.publish", targetType: "TemplateVariant", targetId: variantId, metadata: { version } });
    return { success: true, version, published };
  }

  async publish(templateId: string, versionId: string, actor?: { id?: string; email?: string }) {
    const version = await this.prisma.templateVersion.findFirst({ where: { id: versionId, templateId } });
    if (!version) throw new NotFoundException("Template version not found");
    this.validateYamlContent(version.yamlContent);

    await this.prisma.$transaction([
      this.prisma.templateVersion.updateMany({ where: { templateId }, data: { state: "draft", publishedAt: null } }),
      this.prisma.templateVersion.update({ where: { id: versionId }, data: { state: "published", publishedAt: new Date() } }),
      this.prisma.template.update({ where: { id: templateId }, data: { state: "published", publishedVersionId: versionId } })
    ]);
    await this.audit.log({ actorAdminId: actor?.id, actorEmail: actor?.email, action: "template.publish", targetType: "Template", targetId: templateId, metadata: { versionId } });
    return { success: true };
  }

  async generatePreview(draftId: string, actor?: { id?: string; email?: string }) {
    const draft = await this.prisma.templateDraft.findUnique({ where: { id: draftId }, include: { variant: { include: { family: true } } } });
    if (!draft) throw new NotFoundException("Template draft not found");
    const parsed = this.validateYamlContent(draft.yamlContent);
    const { providerType, endpoint, apiKey, model } = await this.previewProviderConfig();

    if (!endpoint || !apiKey || !model) {
      const message = "Preview provider is not configured. Configure Settings > AI preview provider or set TEMPLATE_PREVIEW_ENDPOINT_URL, TEMPLATE_PREVIEW_API_KEY and TEMPLATE_PREVIEW_MODEL.";
      await this.prisma.templateDraft.update({ where: { id: draftId }, data: { previewError: message } });
      throw new BadRequestException(message);
    }

    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${apiKey}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          model,
          temperature: 0.2,
          messages: [
            {
              role: "system",
              content: "You generate concise markdown previews for an admin reviewing a Ulfy meeting template draft. Use only the provided sample transcript and template instructions. Do not claim the result is published."
            },
            {
              role: "user",
              content: [
                "Template draft YAML:",
                draft.yamlContent,
                "",
                "Sample transcript:",
                draft.sampleTranscript || "No sample transcript was provided.",
                "",
                "Return only markdown for the generated document preview."
              ].join("\n")
            }
          ]
        })
      });

      if (!response.ok) throw new Error(`Preview provider returned ${response.status}`);
      const payload = await response.json() as any;
      const markdown = payload?.choices?.[0]?.message?.content?.trim();
      if (!markdown) throw new Error("Preview provider response did not contain generated markdown.");

      const updated = await this.prisma.templateDraft.update({
        where: { id: draftId },
        data: {
          previewMarkdown: markdown,
          previewStructured: { title: parsed.identity.title, sections: parsed.structure.sections.map((section) => section.title) },
          previewProviderType: providerType,
          previewProviderModel: model,
          previewGeneratedAt: new Date(),
          previewError: null
        }
      });
      await this.audit.log({ actorAdminId: actor?.id, actorEmail: actor?.email, action: "template.preview.generate", targetType: "TemplateDraft", targetId: draftId, metadata: { providerType, model } });
      return this.mapPreview(updated);
    } catch (error) {
      const message = `Preview generation failed: ${(error as Error).message}`;
      const updated = await this.prisma.templateDraft.update({ where: { id: draftId }, data: { previewError: message } });
      return this.mapPreview(updated);
    }
  }

  mapPreview(draft: { previewMarkdown?: string | null; previewStructured?: unknown; previewProviderType?: string | null; previewProviderModel?: string | null; previewGeneratedAt?: Date | null; previewError?: string | null }) {
    return {
      markdown: draft.previewMarkdown ?? null,
      renderedMarkdown: draft.previewMarkdown ?? null,
      extractedFields: draft.previewStructured ?? null,
      provider: draft.previewProviderType ? { type: draft.previewProviderType, model: draft.previewProviderModel } : null,
      generatedAt: draft.previewGeneratedAt?.toISOString() ?? null,
      error: draft.previewError ?? null
    };
  }

  private async previewProviderConfig() {
    const setting = await this.prisma.systemSetting.findUnique({ where: { key: TEMPLATE_PREVIEW_PROVIDER_SETTING_KEY } });
    const stored = this.previewProviderSettingValue(setting?.value);
    return {
      providerType: stored.providerType || process.env.TEMPLATE_PREVIEW_PROVIDER_TYPE || "openai-compatible",
      endpoint: stored.endpointUrl || process.env.TEMPLATE_PREVIEW_ENDPOINT_URL || null,
      apiKey: stored.apiKey || process.env.TEMPLATE_PREVIEW_API_KEY || null,
      model: stored.model || process.env.TEMPLATE_PREVIEW_MODEL || null
    };
  }

  private previewProviderSettingValue(value: unknown) {
    const source = value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
    return {
      providerType: typeof source.providerType === "string" && source.providerType.trim() ? source.providerType.trim() : null,
      endpointUrl: typeof source.endpointUrl === "string" && source.endpointUrl.trim() ? source.endpointUrl.trim() : null,
      apiKey: typeof source.apiKey === "string" && source.apiKey.trim() ? source.apiKey.trim() : null,
      model: typeof source.model === "string" && source.model.trim() ? source.model.trim() : null
    };
  }

  private async entitledPublishedVariants(tenantId: string) {
    return this.prisma.templateVariant.findMany({
      where: {
        family: {
          state: { not: "archived" },
          OR: [{ isGlobal: true }, { entitlements: { some: { tenantId } } }]
        },
        publishedVersions: { some: {} }
      },
      include: this.variantManifestInclude(),
      orderBy: [{ family: { title: "asc" } }, { language: "asc" }]
    });
  }

  private variantManifestInclude() {
    return {
      family: { include: { category: true } },
      publishedVersions: { orderBy: [{ publishedAt: "desc" as const }, { createdAt: "desc" as const }] }
    };
  }

  private manifestFromVariants(variants: any[], name: string) {
    return {
      name,
      templates: variants
        .map((variant) => {
          const latest = variant.publishedVersions?.[0];
          if (!latest) return null;
          const metadata = this.metadataFromYaml(latest.yamlContent);
          return {
            id: metadata.id,
            title: metadata.title,
            short_description: metadata.shortDescription,
            category: metadata.category,
            language: metadata.language,
            version: metadata.version,
            icon: metadata.icon,
            tags: metadata.tags,
            download_url: `/api/v1/templates/${metadata.id}/download`,
            updated_at: latest.publishedAt.toISOString()
          };
        })
        .filter(Boolean)
    };
  }

  private async assertEnterpriseTemplateActivation(activationToken: string) {
    if (!activationToken) throw new UnauthorizedException(mobileError("activation_token_required", "Activation token is required"));
    const activation = await this.prisma.deviceActivation.findUnique({
      where: { activationTokenHash: tokenHash(activationToken) },
      include: { enterpriseLicenseKey: true, tenant: true }
    });
    if (!activation) throw new UnauthorizedException(mobileError("activation_token_invalid", "Invalid activation token"));
    if (activation.kind !== "enterprise" || !activation.tenantId || !activation.enterpriseLicenseKey) {
      throw new ForbiddenException(mobileError("template_repository_enterprise_required", "Template repository access requires an active enterprise activation"));
    }
    this.assertActiveStatus(activation.status, "activation");
    this.assertActiveStatus(activation.enterpriseLicenseKey.status, "license");
    if (activation.enterpriseLicenseKey.expiresAt && activation.enterpriseLicenseKey.expiresAt.getTime() < Date.now()) {
      throw new ForbiddenException(mobileError("license_expired", "License is expired"));
    }
    return activation as typeof activation & { tenantId: string };
  }

  private assertRepositoryApiKey(apiKey: string) {
    const configured = process.env.TEMPLATE_REPOSITORY_API_KEY;
    if (!configured || apiKey !== configured) {
      throw new UnauthorizedException(mobileError("template_repository_unauthorized", "Template repository authorization failed"));
    }
  }

  private assertActiveStatus(status: string, target: "activation" | "license") {
    if (status !== "active") throw new ForbiddenException(mobileError(`${target}_${status}`, `${target === "license" ? "License" : "Activation"} is ${status}`));
  }

  private bumpVersion(version: string, bump: PublishBump) {
    const [major, minor, patch] = version.split(".").map((part) => Number(part));
    if ([major, minor, patch].some((part) => Number.isNaN(part))) return "1.0.0";
    if (bump === "major") return `${major + 1}.0.0`;
    if (bump === "minor") return `${major}.${minor + 1}.0`;
    return `${major}.${minor}.${patch + 1}`;
  }

  private titleFromUseCase(useCase: string) {
    const cleaned = useCase.trim().replace(/\s+/g, " ");
    if (!cleaned) return "New Ulfy template";
    return cleaned.length > 64 ? `${cleaned.slice(0, 61)}...` : cleaned;
  }

  private createYaml(input: {
    id: string;
    title: string;
    shortDescription: string;
    category: string;
    language: string;
    icon: string;
    tags: string[];
    purpose: string;
    sections: Array<{ title: string; purpose: string; format: string; required: boolean }>;
  }) {
    return yaml.dump({
      identity: {
        id: input.id,
        title: input.title,
        icon: input.icon,
        short_description: input.shortDescription,
        category: input.category,
        tags: input.tags,
        language: input.language,
        version: "1.0.0"
      },
      context: {
        purpose: input.purpose,
        typical_setting: "",
        typical_participants: [{ role: "speaker" }],
        goals: ["Create a useful structured note from the transcript."],
        related_processes: []
      },
      perspective: {
        voice: "third_person",
        audience: "self",
        tone: "semi_formell",
        style_rules: ["Write clearly and concisely.", "Do not invent facts not present in the transcript."],
        preserve_original_voice: false
      },
      structure: { sections: input.sections },
      content_rules: {
        required_elements: ["Include only information supported by the transcript."],
        exclusions: ["Do not include unsupported personal details."],
        uncertainty_handling: "Mark unclear or missing information instead of guessing.",
        action_item_format: "Use owner, action, and due date when available.",
        decision_marker: "Mark clear decisions explicitly.",
        speaker_attribution: "none"
      },
      llm_prompting: {
        system_prompt_additions: "",
        fallback_behavior: "If a required section has no support in the transcript, write that it was not covered.",
        post_processing: { extract_action_items: true }
      }
    }, { lineWidth: -1, noRefs: true, sortKeys: false });
  }
}

function TemplateSlug(value: string) {
  return value.trim().toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "") || "template";
}
