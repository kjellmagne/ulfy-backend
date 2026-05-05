import { PrismaClient } from "@prisma/client";
import * as bcrypt from "bcryptjs";
import { createHash, randomBytes } from "crypto";

const prisma = new PrismaClient();
const tagColors = ["#0d9488", "#2563eb", "#7c3aed", "#db2777", "#ea580c", "#15803d", "#475569"];

function sha256(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

function createActivationKey(prefix: "ULFY-S" | "ULFY-E") {
  const body = randomBytes(18).toString("base64url").toUpperCase();
  return `${prefix}-${body.slice(0, 6)}-${body.slice(6, 12)}-${body.slice(12, 18)}-${body.slice(18, 24)}`;
}

export type SeedTemplate = {
  familyId: string;
  variantId: string;
  draftId: string;
  publishedId: string;
  templateId: string;
  title: string;
  shortDescription: string;
  category: string;
  categoryTitle: string;
  icon: string;
  tags: string[];
  purpose: string;
  sections: Array<{ title: string; purpose: string; format: "prose" | "bullet_list" | "numbered_list"; required: boolean }>;
};

export function templateYaml(template: SeedTemplate) {
  return `identity:
  id: ${template.templateId}
  title: ${template.title}
  icon: ${template.icon}
  short_description: ${template.shortDescription}
  category: ${template.category}
  tags:
${template.tags.map((tag) => `    - ${tag}`).join("\n")}
  language: nb-NO
  version: 1.0.0
context:
  purpose: ${template.purpose}
  typical_setting: Internt arbeid eller møte
  typical_participants:
    - role: speaker
  goals:
    - Lage et tydelig og etterprøvbart dokument fra transkripsjonen.
  related_processes: []
perspective:
  voice: third_person
  audience: self
  tone: semi_formell
  style_rules:
    - Skriv klart, konkret og uten å finne på opplysninger.
    - Behold viktig kontekst og usikkerhet fra transkripsjonen.
  preserve_original_voice: false
structure:
  sections:
${template.sections.map((section) => `    - title: ${section.title}
      purpose: ${section.purpose}
      format: ${section.format}
      required: ${section.required}
      extraction_hints: []`).join("\n")}
content_rules:
  required_elements:
    - Ta bare med informasjon som støttes av transkripsjonen.
  exclusions:
    - Ikke legg til irrelevante eller usikre personopplysninger.
  uncertainty_handling: Marker uklare eller manglende opplysninger i stedet for å gjette.
  action_item_format: Bruk ansvarlig, tiltak og frist når det finnes i transkripsjonen.
  decision_marker: Marker tydelige beslutninger eksplisitt.
  speaker_attribution: none
llm_prompting:
  system_prompt_additions: ""
  fallback_behavior: Hvis en påkrevd seksjon ikke har støtte i transkripsjonen, skriv at temaet ikke ble omtalt.
  post_processing:
    extract_action_items: true
`;
}

export const seedTemplates: SeedTemplate[] = [
  {
    familyId: "00000000-0000-4000-8000-000000000301",
    variantId: "00000000-0000-4000-8000-000000000401",
    draftId: "00000000-0000-4000-8000-000000000501",
    publishedId: "00000000-0000-4000-8000-000000000601",
    templateId: "00000000-0000-4000-8000-000000000201",
    title: "Personlig diktat / logg",
    shortDescription: "Kort strukturert logg fra personlig diktat.",
    category: "personlig_diktat",
    categoryTitle: "Personlig diktat",
    icon: "waveform.and.mic",
    tags: ["dictation", "personal"],
    purpose: "Gjør et personlig diktat om til en tydelig logg eller notat.",
    sections: [
      { title: "Sammendrag", purpose: "Oppsummer hovedinnholdet kort.", format: "prose", required: true },
      { title: "Detaljer", purpose: "Ta med viktige detaljer og observasjoner.", format: "bullet_list", required: true },
      { title: "Oppfølging", purpose: "List opp eventuelle videre tiltak.", format: "bullet_list", required: false }
    ]
  },
  {
    familyId: "00000000-0000-4000-8000-000000000302",
    variantId: "00000000-0000-4000-8000-000000000402",
    draftId: "00000000-0000-4000-8000-000000000502",
    publishedId: "00000000-0000-4000-8000-000000000602",
    templateId: "00000000-0000-4000-8000-000000000202",
    title: "Avdelingsmøte",
    shortDescription: "Referat med beslutninger og oppgaver fra avdelingsmøte.",
    category: "avdelingsmote",
    categoryTitle: "Avdelingsmøte",
    icon: "person.3.sequence.fill",
    tags: ["meeting", "department"],
    purpose: "Lage et presist møtereferat for intern oppfølging.",
    sections: [
      { title: "Temaer", purpose: "Oppsummer de viktigste temaene i møtet.", format: "bullet_list", required: true },
      { title: "Beslutninger", purpose: "List tydelige beslutninger.", format: "bullet_list", required: true },
      { title: "Tiltak", purpose: "List oppgaver med ansvarlig og frist når tilgjengelig.", format: "bullet_list", required: false }
    ]
  },
  {
    familyId: "00000000-0000-4000-8000-000000000303",
    variantId: "00000000-0000-4000-8000-000000000403",
    draftId: "00000000-0000-4000-8000-000000000503",
    publishedId: "00000000-0000-4000-8000-000000000603",
    templateId: "00000000-0000-4000-8000-000000000203",
    title: "Oppfølgingssamtale",
    shortDescription: "Strukturert notat fra oppfølgingssamtale.",
    category: "oppfolgingssamtale",
    categoryTitle: "Oppfølgingssamtale",
    icon: "arrow.triangle.2.circlepath",
    tags: ["follow-up", "conversation"],
    purpose: "Dokumentere status, avklaringer og videre oppfølging etter en samtale.",
    sections: [
      { title: "Status", purpose: "Beskriv nåsituasjonen og viktig bakgrunn.", format: "prose", required: true },
      { title: "Avklaringer", purpose: "List viktige avklaringer fra samtalen.", format: "bullet_list", required: true },
      { title: "Neste steg", purpose: "List neste steg med ansvar når det er kjent.", format: "bullet_list", required: true }
    ]
  },
  {
    familyId: "00000000-0000-4000-8000-000000000304",
    variantId: "00000000-0000-4000-8000-000000000404",
    draftId: "00000000-0000-4000-8000-000000000504",
    publishedId: "00000000-0000-4000-8000-000000000604",
    templateId: "00000000-0000-4000-8000-000000000204",
    title: "Jobbintervju",
    shortDescription: "Intervjunotat med vurderinger og oppfølging.",
    category: "jobbintervju",
    categoryTitle: "Jobbintervju",
    icon: "person.text.rectangle",
    tags: ["interview", "hr"],
    purpose: "Lage et ryddig intervjunotat for videre rekrutteringsarbeid.",
    sections: [
      { title: "Kandidatprofil", purpose: "Oppsummer kandidatens relevante bakgrunn.", format: "prose", required: true },
      { title: "Kompetanse og motivasjon", purpose: "List funn knyttet til kompetanse, motivasjon og rolleforståelse.", format: "bullet_list", required: true },
      { title: "Videre vurdering", purpose: "Oppsummer anbefalt videre oppfølging.", format: "prose", required: false }
    ]
  },
  {
    familyId: "00000000-0000-4000-8000-000000000305",
    variantId: "00000000-0000-4000-8000-000000000405",
    draftId: "00000000-0000-4000-8000-000000000505",
    publishedId: "00000000-0000-4000-8000-000000000605",
    templateId: "00000000-0000-4000-8000-000000000205",
    title: "Kartleggingssamtale bruker",
    shortDescription: "Kartleggingsnotat med behov, ressurser og tiltak.",
    category: "kartleggingssamtale",
    categoryTitle: "Kartleggingssamtale",
    icon: "clipboard.fill",
    tags: ["mapping", "user"],
    purpose: "Dokumentere brukerens behov, ressurser og mulige tiltak.",
    sections: [
      { title: "Bakgrunn", purpose: "Oppsummer relevant bakgrunn.", format: "prose", required: true },
      { title: "Behov og ressurser", purpose: "List behov, ressurser og begrensninger som fremkommer.", format: "bullet_list", required: true },
      { title: "Anbefalt oppfølging", purpose: "List foreslåtte tiltak eller videre kartlegging.", format: "bullet_list", required: true }
    ]
  }
];

const templateSectionPresets = [
  {
    slug: "summary",
    title: "Summary",
    purpose: "Summarize the transcript into a short, useful overview.",
    format: "prose",
    required: true,
    extractionHints: ["main topic", "important context", "outcome"],
    sortOrder: 10
  },
  {
    slug: "decisions",
    title: "Decisions",
    purpose: "List clear decisions that were made during the conversation.",
    format: "bullet_list",
    required: false,
    extractionHints: ["decision", "owner", "reason"],
    sortOrder: 20
  },
  {
    slug: "action-items",
    title: "Action items",
    purpose: "Extract follow-up tasks with owner and deadline when present.",
    format: "table",
    required: false,
    extractionHints: ["task", "owner", "deadline"],
    sortOrder: 30
  },
  {
    slug: "risks",
    title: "Risks",
    purpose: "Capture blockers, uncertainty, or sensitive issues mentioned.",
    format: "bullet_list",
    required: false,
    extractionHints: ["risk", "blocker", "dependency"],
    sortOrder: 40
  },
  {
    slug: "follow-up-plan",
    title: "Follow-up plan",
    purpose: "Describe recommended next steps based only on the transcript.",
    format: "numbered_list",
    required: false,
    extractionHints: ["next step", "priority", "responsible party"],
    sortOrder: 50
  }
];

async function seedTemplateSectionPresets() {
  for (const preset of templateSectionPresets) {
    await prisma.templateSectionPreset.upsert({
      where: { slug: preset.slug },
      update: {
        title: preset.title,
        purpose: preset.purpose,
        format: preset.format,
        required: preset.required,
        extractionHints: preset.extractionHints,
        sortOrder: preset.sortOrder
      },
      create: preset
    });
  }
}

async function seedTemplateRepository(tenantId: string) {
  const seedTagNames = [...new Set(seedTemplates.flatMap((template) => template.tags))];
  for (const [index, tag] of seedTagNames.entries()) {
    await prisma.templateTag.upsert({
      where: { slug: tag },
      update: {
        name: titleFromTagSlug(tag),
        color: tagColors[index % tagColors.length]
      },
      create: {
        slug: tag,
        name: titleFromTagSlug(tag),
        color: tagColors[index % tagColors.length],
        description: `${titleFromTagSlug(tag)} templates.`
      }
    });
  }

  for (const [templateIndex, template] of seedTemplates.entries()) {
    const yamlContent = templateYaml(template);
    const category = await prisma.templateCategory.upsert({
      where: { slug: template.category },
      update: { title: template.categoryTitle, icon: template.icon, sortOrder: (templateIndex + 1) * 10 },
      create: { slug: template.category, title: template.categoryTitle, icon: template.icon, sortOrder: (templateIndex + 1) * 10, description: `${template.categoryTitle} templates.` }
    });

    await prisma.templateFamily.upsert({
      where: { id: template.familyId },
      update: {
        title: template.title,
        shortDescription: template.shortDescription,
        categoryId: category.id,
        icon: template.icon,
        tags: template.tags,
        isGlobal: true,
        state: "published"
      },
      create: {
        id: template.familyId,
        title: template.title,
        shortDescription: template.shortDescription,
        categoryId: category.id,
        icon: template.icon,
        tags: template.tags,
        isGlobal: true,
        state: "published"
      }
    });

    await prisma.templateVariant.upsert({
      where: { id: template.variantId },
      update: { familyId: template.familyId, language: "nb-NO", templateIdentityId: template.templateId },
      create: { id: template.variantId, familyId: template.familyId, language: "nb-NO", templateIdentityId: template.templateId }
    });

    await prisma.templateDraft.upsert({
      where: { variantId: template.variantId },
      update: { yamlContent, sampleTranscript: "Deltaker: Dette er en kort eksempeltranskripsjon for forhåndsvisning." },
      create: {
        id: template.draftId,
        variantId: template.variantId,
        yamlContent,
        sampleTranscript: "Deltaker: Dette er en kort eksempeltranskripsjon for forhåndsvisning."
      }
    });

    await prisma.publishedTemplateVersion.upsert({
      where: { variantId_version: { variantId: template.variantId, version: "1.0.0" } },
      update: { yamlContent },
      create: {
        id: template.publishedId,
        variantId: template.variantId,
        version: "1.0.0",
        yamlContent,
        publishedAt: new Date()
      }
    });

    await prisma.tenantTemplateEntitlement.upsert({
      where: { tenantId_familyId: { tenantId, familyId: template.familyId } },
      update: {},
      create: { tenantId, familyId: template.familyId }
    });
  }

  const legacy = seedTemplates[0];
  const legacyCategory = await prisma.templateCategory.findUniqueOrThrow({ where: { slug: legacy.category } });
  const legacyTemplate = await prisma.template.upsert({
    where: { id: legacy.templateId },
    update: {
      title: legacy.title,
      shortDescription: legacy.shortDescription,
      categoryId: legacyCategory.id,
      language: "nb-NO",
      icon: legacy.icon,
      tags: legacy.tags,
      state: "published"
    },
    create: {
      id: legacy.templateId,
      title: legacy.title,
      shortDescription: legacy.shortDescription,
      categoryId: legacyCategory.id,
      language: "nb-NO",
      icon: legacy.icon,
      tags: legacy.tags,
      state: "published"
    }
  });
  const legacyVersion = await prisma.templateVersion.upsert({
    where: { templateId_version: { templateId: legacyTemplate.id, version: "1.0.0" } },
    update: { yamlContent: templateYaml(legacy), state: "published", publishedAt: new Date() },
    create: {
      templateId: legacyTemplate.id,
      version: "1.0.0",
      yamlContent: templateYaml(legacy),
      state: "published",
      publishedAt: new Date()
    }
  });
  await prisma.template.update({ where: { id: legacyTemplate.id }, data: { publishedVersionId: legacyVersion.id } });
}

function titleFromTagSlug(value: string) {
  return value
    .trim()
    .replace(/[-_]+/g, " ")
    .replace(/\s+/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function defaultProviderProfiles() {
  return {
    speech: {
      selected: "azure",
      available: ["local", "apple_online", "azure"],
      providers: {
        local: { type: "local", name: "Local", enabled: true, privacyClass: "Safe", ready: true },
        apple_online: { type: "apple_online", name: "Apple Online", enabled: true, privacyClass: "Use with caution", ready: true },
        azure: { type: "azure", name: "Azure / on-prem speech", enabled: true, endpointUrl: "http://192.168.222.171:5000", modelName: null, privacyClass: "Safe", ready: true }
      }
    },
    formatter: {
      selected: "openai_compatible",
      selectedProviderId: "default-openai-compatible",
      available: ["default-openai-compatible"],
      privacyEmphasis: "managed",
      providers: [
        {
          id: "default-openai-compatible",
          name: "OpenAI-compatible",
          type: "openai_compatible",
          enabled: true,
          builtIn: false,
          endpointUrl: "http://localhost:8000/v1",
          modelName: "meta-llama/Meta-Llama-3.1-8B-Instruct",
          privacyEmphasis: "managed",
          privacyClass: "Managed by default"
        }
      ]
    }
  };
}

function defaultManagedPolicy() {
  return {
    allowPolicyOverride: false,
    hideSettings: false,
    userMayChangeSpeechProvider: false,
    userMayChangeFormatter: false,
    userMayChangePrivacyReviewProvider: false,
    managePrivacyPrompt: false,
    manageTemplateCategories: true
  };
}

async function main() {
  const maintenanceUntil = new Date("2027-04-29T00:00:00.000Z");
  const passwordHash = await bcrypt.hash(process.env.SEED_ADMIN_PASSWORD ?? "ChangeMe123!", 12);
  await prisma.adminUser.upsert({
    where: { email: "admin@ulfy.local" },
    update: {},
    create: {
      email: "admin@ulfy.local",
      fullName: "Ulfy Admin",
      passwordHash,
      role: "superadmin"
    }
  });

  const profile = await prisma.configProfile.upsert({
    where: { id: "00000000-0000-0000-0000-000000000101" },
    update: {
      templateRepositoryUrl: "http://localhost:4000/api/v1/templates/manifest",
      speechProviderType: "azure",
      speechEndpointUrl: "http://192.168.222.171:5000",
      speechModelName: null,
      privacyControlEnabled: true,
      piiControlEnabled: true,
      presidioEndpointUrl: "https://presidio.example.internal",
      presidioSecretRef: "secret://ulfy/presidio",
      presidioApiKey: null,
      presidioScoreThreshold: 0.7,
      presidioFullPersonNamesOnly: false,
      presidioDetectPerson: true,
      presidioDetectEmail: true,
      presidioDetectPhone: true,
      presidioDetectLocation: true,
      presidioDetectIdentifier: true,
      privacyReviewProviderType: "local_heuristic",
      privacyReviewEndpointUrl: null,
      privacyReviewModel: null,
      documentGenerationProviderType: "openai_compatible",
      documentGenerationEndpointUrl: "http://localhost:8000/v1",
      documentGenerationModel: "meta-llama/Meta-Llama-3.1-8B-Instruct",
      featureFlags: { developerMode: false, allowExternalProviders: false },
      allowedProviderRestrictions: ["azure", "openai_compatible", "local_heuristic"],
      providerProfiles: defaultProviderProfiles(),
      managedPolicy: defaultManagedPolicy()
    },
    create: {
      id: "00000000-0000-0000-0000-000000000101",
      name: "Default Enterprise Profile",
      description: "Seeded local development enterprise configuration.",
      speechProviderType: "azure",
      speechEndpointUrl: "http://192.168.222.171:5000",
      speechModelName: null,
      privacyControlEnabled: true,
      piiControlEnabled: true,
      presidioEndpointUrl: "https://presidio.example.internal",
      presidioSecretRef: "secret://ulfy/presidio",
      presidioApiKey: null,
      presidioScoreThreshold: 0.7,
      presidioFullPersonNamesOnly: false,
      presidioDetectPerson: true,
      presidioDetectEmail: true,
      presidioDetectPhone: true,
      presidioDetectLocation: true,
      presidioDetectIdentifier: true,
      privacyReviewProviderType: "local_heuristic",
      privacyReviewEndpointUrl: null,
      privacyReviewModel: null,
      documentGenerationProviderType: "openai_compatible",
      documentGenerationEndpointUrl: "http://localhost:8000/v1",
      documentGenerationModel: "meta-llama/Meta-Llama-3.1-8B-Instruct",
      templateRepositoryUrl: "http://localhost:4000/api/v1/templates/manifest",
      telemetryEndpointUrl: "https://telemetry.example.internal/events",
      featureFlags: { developerMode: false, allowExternalProviders: false },
      allowedProviderRestrictions: ["azure", "openai_compatible", "local_heuristic"],
      providerProfiles: defaultProviderProfiles(),
      managedPolicy: defaultManagedPolicy()
    }
  });

  const tenant = await prisma.tenant.upsert({
    where: { slug: "acme-health" },
    update: {
      legalName: "Acme Health AS",
      organizationNumber: "999888777",
      contactName: "Kari Nordmann",
      contactEmail: "kari@acme-health.example",
      billingEmail: "billing@acme-health.example",
      city: "Oslo",
      country: "NO",
      status: "active",
      configProfileId: profile.id
    },
    create: {
      name: "Acme Health",
      slug: "acme-health",
      legalName: "Acme Health AS",
      organizationNumber: "999888777",
      contactName: "Kari Nordmann",
      contactEmail: "kari@acme-health.example",
      billingEmail: "billing@acme-health.example",
      city: "Oslo",
      country: "NO",
      status: "active",
      configProfileId: profile.id
    }
  });

  await seedTemplateSectionPresets();
  await seedTemplateRepository(tenant.id);

  const singleKey = process.env.SEED_SINGLE_KEY ?? createActivationKey("ULFY-S");
  await prisma.singleLicenseKey.upsert({
    where: { keyHash: sha256(singleKey) },
    update: {},
    create: {
      keyHash: sha256(singleKey),
      keyPrefix: singleKey.slice(0, 14),
      purchaserFullName: "Seed User",
      purchaserEmail: "seed.user@example.com",
      maintenanceUntil,
      notes: "Seeded single-user key for local testing"
    }
  });

  const enterpriseKey = process.env.SEED_ENTERPRISE_KEY ?? createActivationKey("ULFY-E");
  await prisma.enterpriseLicenseKey.upsert({
    where: { keyHash: sha256(enterpriseKey) },
    update: {},
    create: {
      keyHash: sha256(enterpriseKey),
      keyPrefix: enterpriseKey.slice(0, 14),
      tenantId: tenant.id,
      configProfileId: profile.id,
      maxDevices: 100,
      maintenanceUntil,
      notes: "Seeded enterprise key for local testing"
    }
  });

  console.log("Seed admin: admin@ulfy.local /", process.env.SEED_ADMIN_PASSWORD ?? "ChangeMe123!");
  console.log("Seed single key:", singleKey);
  console.log("Seed enterprise key:", enterpriseKey);
}

if (require.main === module) {
  main().finally(async () => prisma.$disconnect());
}
