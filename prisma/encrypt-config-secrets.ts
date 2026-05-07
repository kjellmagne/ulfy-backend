import { PrismaClient } from "@prisma/client";
import { existsSync } from "fs";
import { dirname, resolve } from "path";
import { fileURLToPath, pathToFileURL } from "url";

const TEMPLATE_PREVIEW_PROVIDER_SETTING_KEY = "templatePreviewProvider";

async function main() {
  const {
    encryptConfigProfileSecrets,
    encryptPreviewProviderSetting
  } = await loadSecretCryptoModule();
  const prisma = new PrismaClient();
  try {
    const profiles = await prisma.configProfile.findMany({
      select: {
        id: true,
        speechApiKey: true,
        presidioApiKey: true,
        privacyReviewApiKey: true,
        documentGenerationApiKey: true,
        providerProfiles: true
      }
    });

    let encryptedProfiles = 0;
    for (const profile of profiles) {
      const encrypted = encryptConfigProfileSecrets(profile);
      if (!profilesEqual(profile, encrypted)) {
        await prisma.configProfile.update({
          where: { id: profile.id },
          data: {
            speechApiKey: encrypted.speechApiKey,
            presidioApiKey: encrypted.presidioApiKey,
            privacyReviewApiKey: encrypted.privacyReviewApiKey,
            documentGenerationApiKey: encrypted.documentGenerationApiKey,
            providerProfiles: encrypted.providerProfiles
          }
        });
        encryptedProfiles += 1;
      }
    }

    const previewSetting = await prisma.systemSetting.findUnique({
      where: { key: TEMPLATE_PREVIEW_PROVIDER_SETTING_KEY }
    });

    let encryptedSettings = 0;
    if (previewSetting && previewSetting.value && typeof previewSetting.value === "object" && !Array.isArray(previewSetting.value)) {
      const encrypted = encryptPreviewProviderSetting(previewSetting.value as Record<string, unknown>);
      if (JSON.stringify(previewSetting.value) !== JSON.stringify(encrypted)) {
        await prisma.systemSetting.update({
          where: { key: TEMPLATE_PREVIEW_PROVIDER_SETTING_KEY },
          data: { value: encrypted }
        });
        encryptedSettings += 1;
      }
    }

    console.log(`Encrypted ${encryptedProfiles} config profile record(s) and ${encryptedSettings} preview setting record(s).`);
  } finally {
    await prisma.$disconnect();
  }
}

function profilesEqual(
  current: {
    speechApiKey: string | null;
    presidioApiKey: string | null;
    privacyReviewApiKey: string | null;
    documentGenerationApiKey: string | null;
    providerProfiles: unknown;
  },
  encrypted: {
    speechApiKey?: string | null;
    presidioApiKey?: string | null;
    privacyReviewApiKey?: string | null;
    documentGenerationApiKey?: string | null;
    providerProfiles?: unknown;
  }
) {
  return current.speechApiKey === (encrypted.speechApiKey ?? null)
    && current.presidioApiKey === (encrypted.presidioApiKey ?? null)
    && current.privacyReviewApiKey === (encrypted.privacyReviewApiKey ?? null)
    && current.documentGenerationApiKey === (encrypted.documentGenerationApiKey ?? null)
    && JSON.stringify(current.providerProfiles ?? null) === JSON.stringify(encrypted.providerProfiles ?? null);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

async function loadSecretCryptoModule() {
  const baseDir = dirname(fileURLToPath(import.meta.url));
  for (const candidate of [
    resolve(baseDir, "../apps/api/src/common/secret-crypto.ts"),
    resolve(baseDir, "../apps/api/dist/common/secret-crypto.js")
  ]) {
    if (existsSync(candidate)) {
      return import(pathToFileURL(candidate).href);
    }
  }

  throw new Error("Could not locate secret-crypto module from prisma/encrypt-config-secrets.ts.");
}
