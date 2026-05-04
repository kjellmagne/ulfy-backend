import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException, UnauthorizedException } from "@nestjs/common";
import * as yaml from "js-yaml";
import { randomUUID } from "crypto";
import { TemplateYamlSchema } from "@ulfy/contracts";
import type { TemplateYaml } from "@ulfy/contracts";
import { PrismaService } from "../prisma/prisma.service";
import { AuditService } from "../common/audit.service";
import { mobileError } from "../activation/activation.service";
import { tokenHash } from "../common/crypto";

const TEMPLATE_PREVIEW_PROVIDER_SETTING_KEY = "templatePreviewProvider";

export const AppTemplateYamlSchema = TemplateYamlSchema;
type AppTemplateYaml = TemplateYaml;
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
      return this.toAppCompatibleYaml(version.yamlContent);
    }

    const variant = await this.prisma.templateVariant.findFirst({
      where: { OR: [{ id }, { templateIdentityId: id }], family: { state: { not: "archived" } } },
      include: { publishedVersions: { orderBy: [{ publishedAt: "desc" }, { createdAt: "desc" }] } }
    });
    const latest = variant?.publishedVersions[0];
    if (!latest) throw new NotFoundException("Template not found");
    return this.toAppCompatibleYaml(latest.yamlContent);
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
    return this.toAppCompatibleYaml(latest.yamlContent);
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
    return renderAppCompatibleYaml(parsed);
  }

  toAppCompatibleYaml(yamlContent: string) {
    return renderAppCompatibleYaml(this.validateYamlContent(yamlContent));
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
    if (!isSemver(version)) throw new BadRequestException("Publish version must use semver x.y.z.");
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
      const messages = formatterPreviewMessages(parsed, draft.sampleTranscript || "No sample transcript was provided.");
      const requestBody = {
        model,
        temperature: 0.2,
        response_format: { type: "json_object" },
        messages
      };
      let response = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${apiKey}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify(requestBody)
      });
      if (response.status === 400) {
        const { response_format: _responseFormat, ...fallbackRequestBody } = requestBody;
        response = await fetch(endpoint, {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${apiKey}`,
            "Content-Type": "application/json"
          },
          body: JSON.stringify(fallbackRequestBody)
        });
      }

      if (!response.ok) throw new Error(`Preview provider returned ${response.status}`);
      const payload = await response.json() as any;
      const content = previewTextFromProviderPayload(payload);
      if (!content) throw new Error("Preview provider response did not contain generated content.");
      const formatterPayload = parseFormatterPreviewPayload(content);
      const markdown = previewDocumentMarkdown(formatterPayload, parsed);
      const previewSections = formatterPayload.sections ?? previewSectionsFromMarkdown(markdown, parsed);

      const updated = await this.prisma.templateDraft.update({
        where: { id: draftId },
        data: {
          previewMarkdown: markdown,
          previewStructured: {
            outputContract: "mobile-json-v1",
            title: parsed.identity.title,
            summary: formatterPayload.summary ?? null,
            decisions: formatterPayload.decisions ?? [],
            actions: formatterPayload.actions ?? [],
            blockers: formatterPayload.blockers ?? [],
            nextSteps: formatterPayload.nextSteps ?? [],
            actionItems: formatterPayload.actionItems ?? [],
            structuredOutputJSON: formatterPayload.structuredOutputJSON ?? null,
            sections: previewSections
          },
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

  async previewProviderStatus() {
    const { providerType, endpoint, apiKey, model } = await this.previewProviderConfig();
    const missingFields = [
      !endpoint ? "endpointUrl" : null,
      !apiKey ? "apiKey" : null,
      !model ? "model" : null
    ].filter(Boolean);
    return {
      configured: Boolean(endpoint && apiKey && model),
      providerType: providerType ?? null,
      model: model ?? null,
      endpointConfigured: Boolean(endpoint),
      apiKeyConfigured: Boolean(apiKey),
      missingFields
    };
  }

  private async previewProviderConfig() {
    const setting = await this.prisma.systemSetting.findUnique({ where: { key: TEMPLATE_PREVIEW_PROVIDER_SETTING_KEY } });
    const stored = this.previewProviderSettingValue(setting?.value);
    const providerType = stored.providerType || process.env.TEMPLATE_PREVIEW_PROVIDER_TYPE || "openai-compatible";
    const endpoint = stored.endpointUrl || process.env.TEMPLATE_PREVIEW_ENDPOINT_URL || null;
    return {
      providerType,
      endpoint: this.previewChatCompletionsEndpoint(endpoint, providerType),
      apiKey: stored.apiKey || process.env.TEMPLATE_PREVIEW_API_KEY || null,
      model: stored.model || process.env.TEMPLATE_PREVIEW_MODEL || null
    };
  }

  private previewChatCompletionsEndpoint(endpoint?: string | null, providerType?: string | null) {
    if (!endpoint?.trim()) return null;
    const normalizedProvider = providerType?.trim().toLowerCase().replace(/-/g, "_");
    if (!["openai", "openai_compatible"].includes(normalizedProvider ?? "")) return endpoint.trim();

    try {
      const url = new URL(endpoint.trim());
      const path = url.pathname.replace(/\/+$/, "");
      if (path.endsWith("/chat/completions")) return url.toString();
      const basePath = path
        .replace(/\/responses$/i, "")
        .replace(/\/models$/i, "");
      url.pathname = `${basePath || ""}/chat/completions`.replace(/\/{2,}/g, "/");
      url.search = "";
      return url.toString();
    } catch {
      return endpoint.trim();
    }
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
    return renderAppCompatibleYaml({
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
    });
  }
}

function TemplateSlug(value: string) {
  return value.trim().toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "") || "template";
}

function isSemver(value: string) {
  return /^\d+\.\d+\.\d+$/.test(value);
}

type PreviewMessage = { role: "system" | "user"; content: string };
type PreviewOutputSection = { id: string; title: string; markdown: string };
type FormatterPreviewPayload = {
  documentMarkdown?: string | null;
  summary?: string | null;
  decisions?: string[];
  actions?: string[];
  blockers?: string[];
  nextSteps?: string[];
  actionItems?: string[];
  structuredOutputJSON?: string | null;
  sections?: PreviewOutputSection[];
};

function formatterPreviewMessages(template: AppTemplateYaml, sampleTranscript: string): PreviewMessage[] {
  return [
    { role: "system", content: formatterPreviewSystemPrompt() },
    { role: "user", content: formatterPreviewUserPrompt(template, sampleTranscript) }
  ];
}

function formatterPreviewSystemPrompt() {
  return [
    "You turn transcripts from recordings, meetings, dictations, and reports into template-based structured documents.",
    "Return only valid JSON with exactly these keys:",
    "- documentMarkdown: string",
    "- sections: array of objects with id, title, markdown",
    "- summary: string",
    "- decisions: array of strings",
    "- actions: array of strings",
    "- blockers: array of strings",
    "- nextSteps: array of strings",
    "- actionItems: array of strings",
    "- structuredOutputJSON: string or null",
    "",
    "Every array item outside sections must be a plain string.",
    "Each sections item must match one template section exactly, in the same order, using the provided section id and title.",
    "documentMarkdown must be the complete user-facing document and must follow the selected template sections, order, tone, perspective, content rules, and fallback behavior.",
    "Keep the output factual and faithful to the transcript.",
    "Do not invent people, dates, decisions, action owners, diagnoses, or consent.",
    "If the transcript does not support a section, include one short fallback sentence for that section instead of leaving it empty.",
    "",
    "Language rule:",
    "- Keep the JSON keys in English exactly as specified above.",
    "- Write all user-visible values in the same language as the transcript.",
    "- If the transcript language is unclear, use the template language.",
    "- Keep template section titles exactly as provided."
  ].join("\n");
}

function formatterPreviewUserPrompt(template: AppTemplateYaml, sampleTranscript: string) {
  const sectionPlan = template.structure.sections.map((section) => {
    const hints = bulletList(section.extraction_hints ?? [], "No extraction hints.");
    return [
      `## ${section.title}`,
      `- ID: ${templateSectionId(section)}`,
      `- Purpose: ${section.purpose}`,
      `- Format: ${section.format}`,
      `- Required: ${section.required ? "yes" : "no"}`,
      "- Extraction hints:",
      hints
    ].join("\n");
  }).join("\n\n");
  const postProcessing = template.llm_prompting.post_processing;
  const structuredOutput = postProcessing?.structured_output
    ? JSON.stringify(postProcessing.structured_output, null, 2)
    : null;

  return [
    `Template title: ${template.identity.title}`,
    `Template id: ${template.identity.id}`,
    `Template version: ${template.identity.version}`,
    `Template language: ${template.identity.language}`,
    `Category: ${template.identity.category}`,
    "",
    "Voice, audience, and tone:",
    `- Voice: ${template.perspective.voice}`,
    `- Audience: ${template.perspective.audience}`,
    `- Tone: ${template.perspective.tone}`,
    `- Preserve original voice: ${template.perspective.preserve_original_voice ? "yes" : "no"}`,
    "",
    "Style rules:",
    bulletList(template.perspective.style_rules ?? [], "Use clear, precise, neutral language."),
    "",
    "Template purpose:",
    template.context.purpose,
    "",
    "Typical setting:",
    template.context.typical_setting || "Not specified.",
    "",
    "Participants:",
    bulletList((template.context.typical_participants ?? []).map((participant) => participant.name ? `${participant.role}: ${participant.name}` : participant.role), "Not specified."),
    "",
    "Goals:",
    bulletList(template.context.goals ?? [], "No explicit goals defined."),
    "",
    "Required content:",
    bulletList(template.content_rules.required_elements ?? [], "Use only information supported by the transcript."),
    "",
    "Exclusions:",
    bulletList(template.content_rules.exclusions ?? [], "Do not include irrelevant, unsupported, or unnecessary personal details."),
    "",
    "Uncertainty handling:",
    `- ${template.content_rules.uncertainty_handling || "If the transcript is unclear or incomplete, explicitly mark missing or unclear information instead of inventing content."}`,
    "",
    "Action and decision formatting:",
    `- Action item format: ${template.content_rules.action_item_format || "not specified"}`,
    `- Decision marker: ${template.content_rules.decision_marker || "not specified"}`,
    "",
    "Template-specific system additions:",
    template.llm_prompting.system_prompt_additions || "- No extra template-specific additions.",
    "",
    "Fallback behavior:",
    `- ${template.llm_prompting.fallback_behavior || "If a required section has no support in the transcript, write that it was not covered instead of generating unsupported content."}`,
    "",
    "Output structure:",
    "Use this exact section plan. Include all required sections and keep section titles unchanged.",
    "",
    sectionPlan,
    "",
    "Post-processing:",
    postProcessing?.extract_action_items
      ? "Extract actionItems only when the transcript contains clear, explicit follow-up tasks or commitments. Otherwise return an empty actionItems array."
      : "Return an empty actionItems array for this template.",
    structuredOutput
      ? `If structured side-output is requested, put a JSON string matching this schema in structuredOutputJSON:\n${structuredOutput}`
      : "Return null for structuredOutputJSON.",
    "",
    "Sample transcript:",
    sampleTranscript
  ].join("\n");
}

function previewTextFromProviderPayload(payload: unknown): string | null {
  return textValue(payload)?.trim() || null;
}

function textValue(value: unknown): string | null {
  if (typeof value === "string") return value;
  if (Array.isArray(value)) {
    return value.map(textValue).filter(Boolean).join("\n").trim() || null;
  }
  if (!isPlainObject(value)) return null;

  const directKeys = ["content", "text", "output_text", "message"];
  for (const key of directKeys) {
    const text = textValue(value[key]);
    if (text) return text;
  }

  if (Array.isArray(value.choices)) {
    for (const choice of value.choices) {
      const text = textValue(choice);
      if (text) return text;
    }
  }

  if (Array.isArray(value.output)) {
    for (const item of value.output) {
      const text = textValue(item);
      if (text) return text;
    }
  }

  return null;
}

function parseFormatterPreviewPayload(content: string): FormatterPreviewPayload {
  const candidates = [content, extractJSONObject(content)].filter((value): value is string => Boolean(value?.trim()));
  for (const candidate of candidates) {
    try {
      const parsed = JSON.parse(candidate);
      const payload = normalizeFormatterPreviewPayload(parsed);
      if (payload.documentMarkdown || payload.sections?.length) return payload;
    } catch {
      // Try the next candidate below.
    }
  }

  throw new Error("Preview provider response did not contain the mobile JSON output contract.");
}

function normalizeFormatterPreviewPayload(value: unknown): FormatterPreviewPayload {
  if (!isPlainObject(value)) return {};

  const structuredOutput = value.structuredOutputJSON ?? value.structured_output_json ?? value.structuredoutputjson ?? value.structured_output;
  return {
    documentMarkdown: stringValue(value.documentMarkdown ?? value.document_markdown ?? value.document ?? value.markdown ?? value.note),
    summary: stringValue(value.summary),
    decisions: stringArray(value.decisions),
    actions: stringArray(value.actions),
    blockers: stringArray(value.blockers),
    nextSteps: stringArray(value.nextSteps ?? value.next_steps ?? value.nextsteps),
    actionItems: stringArray(value.actionItems ?? value.action_items ?? value.actionitems),
    structuredOutputJSON: typeof structuredOutput === "string" ? structuredOutput : isPlainObject(structuredOutput) || Array.isArray(structuredOutput) ? JSON.stringify(structuredOutput, null, 2) : null,
    sections: outputSections(value.sections)
  };
}

function previewDocumentMarkdown(payload: FormatterPreviewPayload, template: AppTemplateYaml) {
  const markdown = payload.documentMarkdown?.trim();
  if (markdown && documentMarkdownMatchesRequiredSections(markdown, template)) return markdown;

  if (payload.sections?.length) {
    return payload.sections.map((section) => `## ${section.title}\n${section.markdown}`).join("\n\n");
  }

  if (markdown) {
    throw new Error("Preview documentMarkdown did not include the required template section headings.");
  }

  throw new Error("Preview provider response did not include documentMarkdown or sections.");
}

function documentMarkdownMatchesRequiredSections(markdown: string, template: AppTemplateYaml) {
  const headings = markdown
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => /^#{1,6}\s+\S/.test(line))
    .map((line) => normalizeHeading(line.replace(/^#{1,6}\s+/, "")));
  if (!headings.length) return false;

  const headingSet = new Set(headings);
  return template.structure.sections
    .filter((section) => section.required)
    .every((section) => headingSet.has(normalizeHeading(section.title)));
}

function outputSections(value: unknown): PreviewOutputSection[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const sections = value
    .map((item) => {
      if (!isPlainObject(item)) return null;
      const title = stringValue(item.title);
      const markdown = stringValue(item.markdown ?? item.contentMarkdown ?? item.content ?? item.text);
      if (!title || !markdown) return null;
      return {
        id: stringValue(item.id) || templateSlug(title),
        title,
        markdown
      };
    })
    .filter((item): item is PreviewOutputSection => Boolean(item));
  return sections.length ? sections : undefined;
}

function previewSectionsFromMarkdown(markdown: string, template: AppTemplateYaml): PreviewOutputSection[] {
  const markdownByHeading = markdownSections(markdown);
  return template.structure.sections.map((section) => ({
    id: templateSectionId(section),
    title: section.title,
    markdown: markdownByHeading.get(normalizeHeading(section.title)) ?? "Not covered in the sample transcript."
  }));
}

function markdownSections(markdown: string) {
  const sections = new Map<string, string>();
  let currentHeading: string | null = null;
  let currentBody: string[] = [];

  const commit = () => {
    if (!currentHeading) return;
    const body = currentBody.join("\n").trim();
    if (body) sections.set(currentHeading, body);
  };

  for (const line of markdown.split(/\r?\n/)) {
    const heading = /^#{1,6}\s+(.+?)\s*$/.exec(line);
    if (heading) {
      commit();
      currentHeading = normalizeHeading(heading[1]);
      currentBody = [];
      continue;
    }
    if (currentHeading) currentBody.push(line);
  }

  commit();
  return sections;
}

function stringArray(value: unknown): string[] | undefined {
  if (Array.isArray(value)) {
    const items = value.map(stringValue).filter((item): item is string => Boolean(item));
    return items.length ? items : undefined;
  }
  const string = stringValue(value);
  return string ? [string] : undefined;
}

function stringValue(value: unknown): string | null {
  if (typeof value === "string") return value.trim() || null;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  if (isPlainObject(value)) {
    const preferred = ["text", "title", "summary", "name", "decision", "action", "blocker", "nextStep", "next_step", "item", "markdown", "content"];
    for (const key of preferred) {
      const text = stringValue(value[key]);
      if (text) return text;
    }
  }
  return null;
}

function extractJSONObject(content: string) {
  const fenced = /```(?:json)?\s*([\s\S]*?)```/i.exec(content);
  if (fenced?.[1]?.trim()) return fenced[1].trim();

  const start = content.indexOf("{");
  const end = content.lastIndexOf("}");
  if (start >= 0 && end > start) return content.slice(start, end + 1);
  return null;
}

function templateSectionId(section: AppTemplateYaml["structure"]["sections"][number]) {
  return templateSlug(`${section.title}-${section.purpose}`);
}

function normalizeHeading(value: string) {
  return value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/:/g, "")
    .trim()
    .toLowerCase();
}

function templateSlug(value: string) {
  const folded = value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase();
  const pieces = folded.match(/[\p{L}\p{N}]+/gu) ?? [];
  return pieces.join("_") || randomUUID().toLowerCase();
}

function bulletList(values: string[], fallback: string) {
  const trimmed = values.map((value) => value.trim()).filter(Boolean);
  return trimmed.length ? trimmed.map((value) => `- ${value}`).join("\n") : `- ${fallback}`;
}

function renderAppCompatibleYaml(value: unknown) {
  return `${renderYamlValue(value, 0).join("\n")}\n`;
}

function renderYamlValue(value: unknown, indent: number): string[] {
  if (Array.isArray(value)) return renderYamlArray(value, indent);
  if (isPlainObject(value)) return renderYamlDictionary(value, indent);
  return [`${spaces(indent)}${renderYamlScalar(value)}`];
}

function renderYamlDictionary(dictionary: Record<string, unknown>, indent: number): string[] {
  const entries = Object.entries(dictionary).filter(([, value]) => value !== undefined);
  if (!entries.length) return [`${spaces(indent)}{}`];

  const lines: string[] = [];
  for (const [key, value] of entries) {
    if (isInlineYamlScalar(value)) {
      lines.push(`${spaces(indent)}${key}: ${renderYamlScalar(value)}`);
    } else {
      lines.push(`${spaces(indent)}${key}:`);
      lines.push(...renderYamlValue(value, indent + 2));
    }
  }
  return lines;
}

function renderYamlArray(array: unknown[], indent: number): string[] {
  if (!array.length) return [`${spaces(indent)}[]`];

  const lines: string[] = [];
  for (const item of array) {
    if (isInlineYamlScalar(item)) {
      lines.push(`${spaces(indent)}- ${renderYamlScalar(item)}`);
    } else if (isPlainObject(item)) {
      lines.push(...renderYamlArrayDictionaryItem(item, indent));
    } else {
      lines.push(`${spaces(indent)}-`);
      lines.push(...renderYamlValue(item, indent + 2));
    }
  }
  return lines;
}

function renderYamlArrayDictionaryItem(dictionary: Record<string, unknown>, indent: number): string[] {
  const entries = Object.entries(dictionary).filter(([, value]) => value !== undefined);
  if (!entries.length) return [`${spaces(indent)}- {}`];

  const lines: string[] = [];
  let first = true;
  for (const [key, value] of entries) {
    const prefix = first ? `${spaces(indent)}- ` : spaces(indent + 2);
    if (isInlineYamlScalar(value)) {
      lines.push(`${prefix}${key}: ${renderYamlScalar(value)}`);
    } else {
      lines.push(`${prefix}${key}:`);
      lines.push(...renderYamlValue(value, indent + 4));
    }
    first = false;
  }
  return lines;
}

function renderYamlScalar(value: unknown) {
  if (value === null) return "null";
  if (typeof value === "string") return JSON.stringify(value);
  if (typeof value === "boolean") return value ? "true" : "false";
  if (typeof value === "number") return Number.isFinite(value) ? String(value) : "null";
  if (Array.isArray(value) && value.length === 0) return "[]";
  if (isPlainObject(value) && Object.keys(value).length === 0) return "{}";
  return JSON.stringify(value ?? null);
}

function isInlineYamlScalar(value: unknown) {
  if (value === null) return true;
  if (["string", "boolean", "number"].includes(typeof value)) return true;
  if (Array.isArray(value) && value.length === 0) return true;
  if (isPlainObject(value) && Object.keys(value).length === 0) return true;
  return false;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function spaces(count: number) {
  return " ".repeat(count);
}
