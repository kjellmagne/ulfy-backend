import { PrismaClient } from "@prisma/client";
import * as bcrypt from "bcryptjs";
import { createHash, randomBytes } from "crypto";

const prisma = new PrismaClient();

function sha256(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

function createActivationKey(prefix: "ULFY-S" | "ULFY-E") {
  const body = randomBytes(18).toString("base64url").toUpperCase();
  return `${prefix}-${body.slice(0, 6)}-${body.slice(6, 12)}-${body.slice(12, 18)}-${body.slice(18, 24)}`;
}

async function main() {
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

  const category = await prisma.templateCategory.upsert({
    where: { slug: "personlig_diktat" },
    update: {},
    create: { slug: "personlig_diktat", title: "Personlig diktat", description: "Personal dictation and logging templates." }
  });

  const profile = await prisma.configProfile.upsert({
    where: { id: "00000000-0000-0000-0000-000000000101" },
    update: {},
    create: {
      id: "00000000-0000-0000-0000-000000000101",
      name: "Default Enterprise Profile",
      description: "Seeded local development enterprise configuration.",
      speechProviderType: "openai-compatible",
      speechEndpointUrl: "https://speech.example.internal/v1/audio/transcriptions",
      speechModelName: "whisper-large-v3",
      privacyControlEnabled: true,
      piiControlEnabled: true,
      presidioEndpointUrl: "https://presidio.example.internal",
      presidioSecretRef: "secret://ulfy/presidio",
      privacyReviewProviderType: "openai-compatible",
      privacyReviewEndpointUrl: "https://privacy.example.internal/v1/chat/completions",
      privacyReviewModel: "privacy-review-v1",
      documentGenerationProviderType: "openai-compatible",
      documentGenerationEndpointUrl: "https://docs.example.internal/v1/chat/completions",
      documentGenerationModel: "docgen-v1",
      templateRepositoryUrl: "http://localhost:4000/api/v1/templates/manifest",
      telemetryEndpointUrl: "https://telemetry.example.internal/events",
      featureFlags: { enterpriseTemplates: true, privacyReview: true },
      allowedProviderRestrictions: ["openai-compatible", "internal"]
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
      status: "active"
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

  const yamlContent = `title: Personlig diktat / logg
language: nb-NO
sections:
  - id: context
    title: Kontekst
    prompt: Oppsummer relevant kontekst kort.
  - id: dictation
    title: Diktat
    prompt: Skriv en strukturert logg basert på brukerens diktat.
`;

  const template = await prisma.template.upsert({
    where: { id: "00000000-0000-0000-0000-000000000201" },
    update: {},
    create: {
      id: "00000000-0000-0000-0000-000000000201",
      title: "Personlig diktat / logg",
      shortDescription: "Kort beskrivelse",
      categoryId: category.id,
      language: "nb-NO",
      icon: "waveform.and.mic",
      tags: ["dictation", "personal"],
      state: "published",
      versions: {
        create: {
          id: "00000000-0000-0000-0000-000000000202",
          version: "1.0.0",
          yamlContent,
          state: "published",
          publishedAt: new Date()
        }
      }
    }
  });
  await prisma.template.update({ where: { id: template.id }, data: { publishedVersionId: "00000000-0000-0000-0000-000000000202" } });

  const singleKey = process.env.SEED_SINGLE_KEY ?? createActivationKey("ULFY-S");
  await prisma.singleLicenseKey.upsert({
    where: { keyHash: sha256(singleKey) },
    update: {},
    create: {
      keyHash: sha256(singleKey),
      keyPrefix: singleKey.slice(0, 14),
      purchaserFullName: "Seed User",
      purchaserEmail: "seed.user@example.com",
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
      notes: "Seeded enterprise key for local testing"
    }
  });

  console.log("Seed admin: admin@ulfy.local /", process.env.SEED_ADMIN_PASSWORD ?? "ChangeMe123!");
  console.log("Seed single key:", singleKey);
  console.log("Seed enterprise key:", enterpriseKey);
}

main().finally(async () => prisma.$disconnect());
