import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { randomUUID } from "crypto";
import { JwtService } from "@nestjs/jwt";
import { LicenseStatus } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { AuditService } from "../common/audit.service";
import { sha256, tokenHash } from "../common/crypto";

type ActivationInput = { activationKey: string; deviceIdentifier: string; deviceSerialNumber?: string; appVersion: string };
type RefreshInput = { activationToken: string; deviceIdentifier?: string; deviceSerialNumber?: string; appVersion?: string };

@Injectable()
export class ActivationService {
  constructor(private readonly prisma: PrismaService, private readonly audit: AuditService, private readonly jwt: JwtService) {}

  async activateSingle(input: ActivationInput) {
    const key = await this.prisma.singleLicenseKey.findUnique({ where: { keyHash: sha256(input.activationKey) } });
    if (!key) throw new NotFoundException(mobileError("activation_key_invalid", "Activation key not found"));
    this.assertUsable(key.status, key.expiresAt);

    if (key.deviceIdentifier && key.deviceIdentifier !== input.deviceIdentifier) {
      throw new ForbiddenException(mobileError("license_already_bound", "Activation key is already bound to another device"));
    }

    const activationToken = await this.issueActivationToken("single", key.id, input.deviceIdentifier);
    const now = new Date();
    const activation = await this.prisma.deviceActivation.upsert({
      where: { singleLicenseKeyId_deviceIdentifier: { singleLicenseKeyId: key.id, deviceIdentifier: input.deviceIdentifier } },
      update: {
        activationTokenHash: tokenHash(activationToken),
        lastCheckIn: now,
        lastSeenAt: now,
        appVersion: input.appVersion,
        deviceSerialNumber: input.deviceSerialNumber,
        status: "active"
      },
      create: {
        kind: "single",
        singleLicenseKeyId: key.id,
        deviceIdentifier: input.deviceIdentifier,
        deviceSerialNumber: input.deviceSerialNumber,
        activationTokenHash: tokenHash(activationToken),
        appVersion: input.appVersion,
        lastCheckIn: now,
        lastSeenAt: now,
        status: "active"
      }
    });

    const activatedAt = key.activatedAt ?? now;
    const updatedKey = await this.prisma.singleLicenseKey.update({
      where: { id: key.id },
      data: {
        activatedAt,
        deviceIdentifier: input.deviceIdentifier,
        deviceSerialNumber: input.deviceSerialNumber,
        appVersion: input.appVersion,
        lastCheckIn: now,
        lastSeenAt: now
      }
    });
    await this.audit.log({ action: "activation.single", targetType: "SingleLicenseKey", targetId: key.id, metadata: { deviceIdentifier: input.deviceIdentifier, deviceSerialNumber: input.deviceSerialNumber } });

    return {
      success: true,
      activationToken,
      activationId: activation.id,
      license: this.mapSingleLicense(updatedKey),
      device: this.mapDevice(activation),
      config: {}
    };
  }

  async activateEnterprise(input: ActivationInput) {
    const key = await this.prisma.enterpriseLicenseKey.findUnique({
      where: { keyHash: sha256(input.activationKey) },
      include: { tenant: true, configProfile: true, activations: true }
    });
    if (!key) throw new NotFoundException(mobileError("enterprise_key_invalid", "Enterprise key not found"));
    this.assertUsable(key.status, key.expiresAt);

    const existingForDevice = key.activations.find((item) => item.deviceIdentifier === input.deviceIdentifier);
    if (!existingForDevice && key.maxDevices && key.activations.filter((item) => item.status === "active").length >= key.maxDevices) {
      throw new ForbiddenException(mobileError("enterprise_device_limit_reached", "Enterprise device limit reached"));
    }

    const activationToken = await this.issueActivationToken("enterprise", key.id, input.deviceIdentifier);
    const now = new Date();
    const activation = await this.prisma.deviceActivation.upsert({
      where: { enterpriseLicenseKeyId_deviceIdentifier: { enterpriseLicenseKeyId: key.id, deviceIdentifier: input.deviceIdentifier } },
      update: {
        activationTokenHash: tokenHash(activationToken),
        lastCheckIn: now,
        lastSeenAt: now,
        appVersion: input.appVersion,
        deviceSerialNumber: input.deviceSerialNumber,
        status: "active"
      },
      create: {
        kind: "enterprise",
        enterpriseLicenseKeyId: key.id,
        tenantId: key.tenantId,
        deviceIdentifier: input.deviceIdentifier,
        deviceSerialNumber: input.deviceSerialNumber,
        activationTokenHash: tokenHash(activationToken),
        appVersion: input.appVersion,
        lastCheckIn: now,
        lastSeenAt: now,
        status: "active"
      }
    });
    await this.audit.log({ action: "activation.enterprise", targetType: "EnterpriseLicenseKey", targetId: key.id, metadata: { deviceIdentifier: input.deviceIdentifier, deviceSerialNumber: input.deviceSerialNumber } });

    return {
      success: true,
      activationToken,
      activationId: activation.id,
      license: this.mapEnterpriseLicense(key, activation.activatedAt),
      tenant: this.mapTenant(key.tenant),
      device: this.mapDevice(activation),
      config: await this.mapConfig(key.configProfile)
    };
  }

  async refresh(input: RefreshInput) {
    const activation = await this.findActivationByToken(input.activationToken);
    this.assertUsable(activation.status, null);
    this.assertActivationLicenseUsable(activation);
    if (input.deviceIdentifier && input.deviceIdentifier !== activation.deviceIdentifier) {
      throw new ForbiddenException(mobileError("activation_device_mismatch", "Activation token does not belong to this device"));
    }
    const now = new Date();
    await this.prisma.deviceActivation.update({
      where: { id: activation.id },
      data: {
        lastCheckIn: now,
        lastSeenAt: now,
        appVersion: input.appVersion ?? activation.appVersion,
        deviceSerialNumber: input.deviceSerialNumber ?? activation.deviceSerialNumber
      }
    });
    if (activation.singleLicenseKeyId) {
      await this.prisma.singleLicenseKey.update({
        where: { id: activation.singleLicenseKeyId },
        data: {
          lastCheckIn: now,
          lastSeenAt: now,
          appVersion: input.appVersion ?? activation.appVersion,
          deviceSerialNumber: input.deviceSerialNumber ?? activation.deviceSerialNumber
        }
      });
    }
    const refreshedActivation = {
      ...activation,
      lastSeenAt: now,
      appVersion: input.appVersion ?? activation.appVersion,
      deviceSerialNumber: input.deviceSerialNumber ?? activation.deviceSerialNumber
    };
    const config = activation.enterpriseLicenseKey?.configProfile ? await this.mapConfig(activation.enterpriseLicenseKey.configProfile) : {};
    const tenant = activation.enterpriseLicenseKey?.tenant ? this.mapTenant(activation.enterpriseLicenseKey.tenant) : null;
    return {
      success: true,
      status: activation.status,
      kind: activation.kind,
      lastSeenAt: now.toISOString(),
      license: this.mapActivationLicense(refreshedActivation),
      tenant,
      device: this.mapDevice(refreshedActivation),
      config
    };
  }

  async effectiveConfig(activationToken: string) {
    if (!activationToken) throw new BadRequestException(mobileError("activation_token_required", "activationToken query parameter is required"));
    const activation = await this.findActivationByToken(activationToken);
    this.assertUsable(activation.status, null);
    this.assertActivationLicenseUsable(activation);
    const tenant = activation.enterpriseLicenseKey?.tenant ? this.mapTenant(activation.enterpriseLicenseKey.tenant) : null;
    return {
      success: true,
      tenant,
      license: this.mapActivationLicense(activation),
      config: activation.enterpriseLicenseKey?.configProfile ? await this.mapConfig(activation.enterpriseLicenseKey.configProfile) : {}
    };
  }

  async licenseDetails(activationToken: string) {
    if (!activationToken) throw new BadRequestException(mobileError("activation_token_required", "activationToken query parameter is required"));
    const activation = await this.findActivationByToken(activationToken);
    this.assertUsable(activation.status, null);
    this.assertActivationLicenseUsable(activation);
    const tenant = activation.enterpriseLicenseKey?.tenant ? this.mapTenant(activation.enterpriseLicenseKey.tenant) : null;
    return {
      success: true,
      license: this.mapActivationLicense(activation),
      tenant,
      device: this.mapDevice(activation),
      config: activation.enterpriseLicenseKey?.configProfile ? await this.mapConfig(activation.enterpriseLicenseKey.configProfile) : {}
    };
  }

  private async findActivationByToken(activationToken: string) {
    const activation = await this.prisma.deviceActivation.findUnique({
      where: { activationTokenHash: tokenHash(activationToken) },
      include: {
        singleLicenseKey: true,
        enterpriseLicenseKey: { include: { configProfile: true, tenant: true } },
        tenant: true
      }
    });
    if (!activation) throw new UnauthorizedActivation();
    return activation;
  }

  private async issueActivationToken(kind: "single" | "enterprise", licenseId: string, deviceIdentifier: string) {
    return this.jwt.signAsync(
      { kind, licenseId, deviceIdentifier, nonce: randomUUID() },
      { secret: process.env.ACTIVATION_TOKEN_SECRET ?? "dev-activation-secret", expiresIn: "365d" }
    );
  }

  private assertUsable(status: LicenseStatus, expiresAt?: Date | null) {
    if (status !== "active") throw new ForbiddenException(mobileError(`license_${status}`, `License is ${status}`));
    if (expiresAt && expiresAt.getTime() < Date.now()) throw new ForbiddenException(mobileError("license_expired", "License is expired"));
  }

  private assertActivationLicenseUsable(activation: any) {
    if (activation.kind === "single" && activation.singleLicenseKey) {
      this.assertUsable(activation.singleLicenseKey.status, activation.singleLicenseKey.expiresAt);
    }
    if (activation.kind === "enterprise" && activation.enterpriseLicenseKey) {
      this.assertUsable(activation.enterpriseLicenseKey.status, activation.enterpriseLicenseKey.expiresAt);
    }
  }

  private mapDevice(activation: { deviceIdentifier: string; deviceSerialNumber?: string | null; lastSeenAt?: Date | null; lastCheckIn?: Date | null }) {
    const lastSeenAt = activation.lastSeenAt ?? activation.lastCheckIn ?? new Date();
    return {
      deviceIdentifier: activation.deviceIdentifier,
      deviceSerialNumber: activation.deviceSerialNumber ?? null,
      lastSeenAt: lastSeenAt.toISOString()
    };
  }

  private mapActivationLicense(activation: any) {
    if (activation.kind === "single" && activation.singleLicenseKey) {
      return this.mapSingleLicense(activation.singleLicenseKey);
    }
    if (activation.kind === "enterprise" && activation.enterpriseLicenseKey) {
      return this.mapEnterpriseLicense(activation.enterpriseLicenseKey, activation.activatedAt);
    }
    return {
      type: activation.kind,
      status: activation.status,
      registeredToName: null,
      registeredToEmail: null,
      activatedAt: activation.activatedAt?.toISOString?.() ?? null,
      maintenanceActive: false,
      maintenanceUntil: null
    };
  }

  private mapSingleLicense(key: { purchaserFullName: string; purchaserEmail: string; status: LicenseStatus; activatedAt?: Date | null; maintenanceUntil?: Date | null }) {
    return {
      type: "single",
      status: key.status,
      registeredToName: key.purchaserFullName,
      registeredToEmail: key.purchaserEmail,
      activatedAt: key.activatedAt?.toISOString() ?? null,
      maintenanceActive: this.isMaintenanceActive(key.status, key.maintenanceUntil),
      maintenanceUntil: key.maintenanceUntil?.toISOString() ?? null
    };
  }

  private mapEnterpriseLicense(key: { status: LicenseStatus; maintenanceUntil?: Date | null; tenant: any }, activatedAt?: Date | null) {
    const tenant = key.tenant;
    return {
      type: "enterprise",
      status: key.status,
      registeredToName: tenant.legalName ?? tenant.name,
      registeredToEmail: tenant.contactEmail ?? tenant.billingEmail ?? null,
      activatedAt: activatedAt?.toISOString() ?? null,
      maintenanceActive: this.isMaintenanceActive(key.status, key.maintenanceUntil),
      maintenanceUntil: key.maintenanceUntil?.toISOString() ?? null
    };
  }

  private isMaintenanceActive(status: LicenseStatus, maintenanceUntil?: Date | null) {
    return status === "active" && (!maintenanceUntil || maintenanceUntil.getTime() >= Date.now());
  }

  private mapTenant(tenant: any) {
    return {
      id: tenant.id,
      name: tenant.name,
      slug: tenant.slug,
      legalName: tenant.legalName,
      organizationNumber: tenant.organizationNumber,
      contactName: tenant.contactName,
      contactEmail: tenant.contactEmail,
      contactPhone: tenant.contactPhone,
      billingEmail: tenant.billingEmail,
      addressLine1: tenant.addressLine1,
      addressLine2: tenant.addressLine2,
      postalCode: tenant.postalCode,
      city: tenant.city,
      country: tenant.country,
      status: tenant.status
    };
  }

  private async mapConfig(profile: any) {
    const templateCategories = await this.templateCategoryCatalog();
    return compactObject({
      id: profile.id,
      name: profile.name,
      speechProviderType: profile.speechProviderType,
      speechEndpointUrl: profile.speechEndpointUrl,
      speechModelName: profile.speechModelName,
      speechApiKey: profile.speechApiKey,
      privacyControlEnabled: profile.privacyControlEnabled,
      piiControlEnabled: profile.piiControlEnabled,
      presidioEndpointUrl: profile.presidioEndpointUrl,
      presidioSecretRef: profile.presidioSecretRef,
      presidioApiKey: profile.presidioApiKey,
      presidioScoreThreshold: profile.presidioScoreThreshold,
      presidioFullPersonNamesOnly: profile.presidioFullPersonNamesOnly,
      presidioDetectPerson: profile.presidioDetectPerson,
      presidioDetectEmail: profile.presidioDetectEmail,
      presidioDetectPhone: profile.presidioDetectPhone,
      presidioDetectLocation: profile.presidioDetectLocation,
      presidioDetectIdentifier: profile.presidioDetectIdentifier,
      privacyReviewProviderType: normalizeOpenAiCompatibleProvider(profile.privacyReviewProviderType),
      privacyReviewEndpointUrl: profile.privacyReviewEndpointUrl,
      privacyReviewModel: profile.privacyReviewModel,
      privacyReviewApiKey: profile.privacyReviewApiKey,
      documentGenerationProviderType: normalizeOpenAiCompatibleProvider(profile.documentGenerationProviderType),
      documentGenerationEndpointUrl: profile.documentGenerationEndpointUrl,
      documentGenerationModel: profile.documentGenerationModel,
      documentGenerationApiKey: profile.documentGenerationApiKey,
      templateRepositoryUrl: profile.templateRepositoryUrl,
      telemetryEndpointUrl: profile.telemetryEndpointUrl,
      featureFlags: profile.featureFlags,
      allowedProviderRestrictions: profile.allowedProviderRestrictions,
      providerProfiles: profile.providerProfiles,
      templateCategories,
      managedPolicy: this.mapManagedPolicy(profile.managedPolicy),
      defaultTemplateId: profile.defaultTemplateId
    });
  }

  private async templateCategoryCatalog() {
    const categories = await this.prisma.templateCategory.findMany({
      orderBy: [{ sortOrder: "asc" }, { title: "asc" }],
      select: { slug: true, title: true, icon: true }
    });
    return categories.map((category) => ({
      id: category.slug,
      title: category.title,
      icon: category.icon || "folder"
    }));
  }

  private mapManagedPolicy(policy: unknown) {
    const source = isRecord(policy) ? policy : {};
    const overrideValue = firstBoolean(source.allowPolicyOverride, source.allowLocalOverride, source.userMayOverridePolicy);
    const hideSettingsValue = firstBoolean(source.hideSettings, source.hideAppSettings, source.hideSettingsUI);
    const speechChangeValue = firstBoolean(source.userMayChangeSpeechProvider, source.userMayChangeSpeech, source.allowSpeechProviderChange);
    const formatterChangeValue = firstBoolean(source.userMayChangeFormatter, source.userMayChangeDocumentGenerationProvider, source.allowFormatterChange);
    const privacyReviewChangeValue = firstBoolean(source.userMayChangePrivacyReviewProvider, source.userMayChangePrivacyReview, source.allowPrivacyReviewProviderChange);
    return {
      ...source,
      allowPolicyOverride: overrideValue ?? false,
      hideSettings: hideSettingsValue ?? false,
      userMayChangeSpeechProvider: speechChangeValue ?? false,
      userMayChangeFormatter: formatterChangeValue ?? false,
      userMayChangePrivacyReviewProvider: privacyReviewChangeValue ?? false
    };
  }
}

class UnauthorizedActivation extends ForbiddenException {
  constructor() {
    super(mobileError("activation_token_invalid", "Invalid activation token"));
  }
}

export function mobileError(code: string, message: string) {
  return { success: false, error: { code, message } };
}

function compactObject(input: Record<string, unknown>) {
  return Object.fromEntries(Object.entries(input).filter(([, value]) => {
    if (value === null || value === undefined || value === "") return false;
    if (Array.isArray(value) && value.length === 0) return false;
    if (typeof value === "object" && !Array.isArray(value) && Object.keys(value as Record<string, unknown>).length === 0) return false;
    return true;
  }));
}

function normalizeOpenAiCompatibleProvider(providerType?: string | null) {
  if (providerType === "openai" || providerType === "vllm") return "openai_compatible";
  return providerType;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function firstBoolean(...values: unknown[]) {
  return values.find((value): value is boolean => typeof value === "boolean");
}
