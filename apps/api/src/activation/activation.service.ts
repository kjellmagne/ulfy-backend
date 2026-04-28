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
    if (!key) throw new NotFoundException({ success: false, error: "Activation key not found" });
    this.assertUsable(key.status, key.expiresAt);

    if (key.deviceIdentifier && key.deviceIdentifier !== input.deviceIdentifier) {
      throw new ForbiddenException({ success: false, error: "Activation key is already bound to another device" });
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

    await this.prisma.singleLicenseKey.update({
      where: { id: key.id },
      data: {
        activatedAt: key.activatedAt ?? now,
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
      license: { type: "single", status: "active" },
      device: this.mapDevice(activation),
      config: {}
    };
  }

  async activateEnterprise(input: ActivationInput) {
    const key = await this.prisma.enterpriseLicenseKey.findUnique({
      where: { keyHash: sha256(input.activationKey) },
      include: { tenant: true, configProfile: true, activations: true }
    });
    if (!key) throw new NotFoundException({ success: false, error: "Enterprise key not found" });
    this.assertUsable(key.status, key.expiresAt);

    const existingForDevice = key.activations.find((item) => item.deviceIdentifier === input.deviceIdentifier);
    if (!existingForDevice && key.maxDevices && key.activations.filter((item) => item.status === "active").length >= key.maxDevices) {
      throw new ForbiddenException({ success: false, error: "Enterprise device limit reached" });
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
      tenant: { id: key.tenant.id, name: key.tenant.name, slug: key.tenant.slug },
      device: this.mapDevice(activation),
      config: this.mapConfig(key.configProfile)
    };
  }

  async refresh(input: RefreshInput) {
    const activation = await this.findActivationByToken(input.activationToken);
    this.assertUsable(activation.status, null);
    if (input.deviceIdentifier && input.deviceIdentifier !== activation.deviceIdentifier) {
      throw new ForbiddenException({ success: false, error: "Activation token does not belong to this device" });
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
    const config = activation.enterpriseLicenseKey?.configProfile ? this.mapConfig(activation.enterpriseLicenseKey.configProfile) : {};
    return {
      success: true,
      status: activation.status,
      kind: activation.kind,
      lastSeenAt: now.toISOString(),
      device: {
        deviceIdentifier: activation.deviceIdentifier,
        deviceSerialNumber: input.deviceSerialNumber ?? activation.deviceSerialNumber ?? null,
        lastSeenAt: now.toISOString()
      },
      config
    };
  }

  async effectiveConfig(activationToken: string) {
    if (!activationToken) throw new BadRequestException("activationToken query parameter is required");
    const activation = await this.findActivationByToken(activationToken);
    this.assertUsable(activation.status, null);
    if (activation.kind !== "enterprise" || !activation.enterpriseLicenseKey?.configProfile) return { config: {} };
    return { tenantId: activation.tenantId, config: this.mapConfig(activation.enterpriseLicenseKey.configProfile) };
  }

  private async findActivationByToken(activationToken: string) {
    const activation = await this.prisma.deviceActivation.findUnique({
      where: { activationTokenHash: tokenHash(activationToken) },
      include: { enterpriseLicenseKey: { include: { configProfile: true } } }
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
    if (status !== "active") throw new ForbiddenException({ success: false, error: `License is ${status}` });
    if (expiresAt && expiresAt.getTime() < Date.now()) throw new ForbiddenException({ success: false, error: "License is expired" });
  }

  private mapDevice(activation: { deviceIdentifier: string; deviceSerialNumber?: string | null; lastSeenAt?: Date | null; lastCheckIn?: Date | null }) {
    const lastSeenAt = activation.lastSeenAt ?? activation.lastCheckIn ?? new Date();
    return {
      deviceIdentifier: activation.deviceIdentifier,
      deviceSerialNumber: activation.deviceSerialNumber ?? null,
      lastSeenAt: lastSeenAt.toISOString()
    };
  }

  private mapConfig(profile: any) {
    return {
      id: profile.id,
      name: profile.name,
      speechProviderType: profile.speechProviderType,
      speechEndpointUrl: profile.speechEndpointUrl,
      speechModelName: profile.speechModelName,
      privacyControlEnabled: profile.privacyControlEnabled,
      piiControlEnabled: profile.piiControlEnabled,
      presidioEndpointUrl: profile.presidioEndpointUrl,
      presidioSecretRef: profile.presidioSecretRef,
      privacyReviewProviderType: profile.privacyReviewProviderType,
      privacyReviewEndpointUrl: profile.privacyReviewEndpointUrl,
      privacyReviewModel: profile.privacyReviewModel,
      documentGenerationProviderType: profile.documentGenerationProviderType,
      documentGenerationEndpointUrl: profile.documentGenerationEndpointUrl,
      documentGenerationModel: profile.documentGenerationModel,
      templateRepositoryUrl: profile.templateRepositoryUrl,
      telemetryEndpointUrl: profile.telemetryEndpointUrl,
      featureFlags: profile.featureFlags,
      allowedProviderRestrictions: profile.allowedProviderRestrictions,
      defaultTemplateId: profile.defaultTemplateId
    };
  }
}

class UnauthorizedActivation extends ForbiddenException {
  constructor() {
    super({ success: false, error: "Invalid activation token" });
  }
}
