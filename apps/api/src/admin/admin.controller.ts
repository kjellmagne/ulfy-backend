import { Body, Controller, Get, Param, Patch, Post, Req, UseGuards } from "@nestjs/common";
import { IsArray, IsEmail, IsInt, IsOptional, IsString, Min, MinLength } from "class-validator";
import { PrismaService } from "../prisma/prisma.service";
import { AdminGuard } from "../auth/admin.guard";
import { createActivationKey, sha256 } from "../common/crypto";
import { AuditService } from "../common/audit.service";
import { TemplatesService } from "../templates/templates.service";

class SingleKeyDto {
  @IsString()
  purchaserFullName!: string;
  @IsEmail()
  purchaserEmail!: string;
  @IsOptional()
  @IsString()
  purchaseDate?: string;
  @IsOptional()
  @IsString()
  notes?: string;
  @IsOptional()
  @IsString()
  partnerId?: string;
}

class EnterpriseKeyDto {
  @IsString()
  tenantId!: string;
  @IsString()
  configProfileId!: string;
  @IsOptional()
  @IsInt()
  @Min(1)
  maxDevices?: number;
  @IsOptional()
  @IsString()
  notes?: string;
}

class ConfigDto {
  @IsString()
  name!: string;
  @IsOptional()
  description?: string;
  [key: string]: unknown;
}

class TemplateDto {
  @IsString()
  title!: string;
  @IsString()
  shortDescription!: string;
  @IsOptional()
  @IsString()
  categoryId?: string;
  @IsString()
  language!: string;
  @IsString()
  icon!: string;
  @IsArray()
  tags!: string[];
  @IsOptional()
  @IsString()
  tenantId?: string;
  @IsString()
  @MinLength(1)
  version!: string;
  @IsString()
  yamlContent!: string;
}

@UseGuards(AdminGuard)
@Controller("admin")
export class AdminController {
  constructor(private readonly prisma: PrismaService, private readonly audit: AuditService, private readonly templates: TemplatesService) {}

  @Get("me")
  me(@Req() req: any) {
    return req.user;
  }

  @Get("overview")
  async overview() {
    const [singleKeys, enterpriseKeys, activations, templates, audits] = await Promise.all([
      this.prisma.singleLicenseKey.count(),
      this.prisma.enterpriseLicenseKey.count(),
      this.prisma.deviceActivation.count(),
      this.prisma.template.count(),
      this.prisma.activationAuditLog.findMany({ orderBy: { createdAt: "desc" }, take: 25 })
    ]);
    return { singleKeys, enterpriseKeys, activations, templates, audits };
  }

  @Get("single-keys")
  singleKeys() {
    return this.prisma.singleLicenseKey.findMany({ orderBy: { createdAt: "desc" }, include: { partner: true, activations: true } });
  }

  @Post("single-keys")
  async createSingleKey(@Body() dto: SingleKeyDto, @Req() req: any) {
    const activationKey = createActivationKey("ULFY-S");
    const key = await this.prisma.singleLicenseKey.create({
      data: {
        keyHash: sha256(activationKey),
        keyPrefix: activationKey.slice(0, 14),
        purchaserFullName: dto.purchaserFullName,
        purchaserEmail: dto.purchaserEmail,
        purchaseDate: dto.purchaseDate ? new Date(dto.purchaseDate) : undefined,
        notes: dto.notes,
        partnerId: dto.partnerId,
        createdByAdminId: req.user.sub
      }
    });
    await this.audit.log({ actorAdminId: req.user.sub, actorEmail: req.user.email, action: "license.single.generate", targetType: "SingleLicenseKey", targetId: key.id });
    return { ...key, activationKey };
  }

  @Patch("single-keys/:id/revoke")
  async revokeSingle(@Param("id") id: string, @Req() req: any) {
    const key = await this.prisma.singleLicenseKey.update({ where: { id }, data: { status: "revoked" } });
    await this.prisma.deviceActivation.updateMany({ where: { singleLicenseKeyId: id }, data: { status: "revoked" } });
    await this.audit.log({ actorAdminId: req.user.sub, actorEmail: req.user.email, action: "license.single.revoke", targetType: "SingleLicenseKey", targetId: id });
    return key;
  }

  @Patch("single-keys/:id/reset")
  async resetSingle(@Param("id") id: string, @Req() req: any) {
    await this.prisma.deviceActivation.deleteMany({ where: { singleLicenseKeyId: id } });
    const key = await this.prisma.singleLicenseKey.update({ where: { id }, data: { deviceIdentifier: null, activatedAt: null, lastCheckIn: null, status: "active" } });
    await this.audit.log({ actorAdminId: req.user.sub, actorEmail: req.user.email, action: "license.single.reset", targetType: "SingleLicenseKey", targetId: id });
    return key;
  }

  @Get("enterprise-keys")
  enterpriseKeys() {
    return this.prisma.enterpriseLicenseKey.findMany({ orderBy: { createdAt: "desc" }, include: { tenant: true, configProfile: true, activations: true } });
  }

  @Post("enterprise-keys")
  async createEnterpriseKey(@Body() dto: EnterpriseKeyDto, @Req() req: any) {
    const activationKey = createActivationKey("ULFY-E");
    const key = await this.prisma.enterpriseLicenseKey.create({
      data: {
        keyHash: sha256(activationKey),
        keyPrefix: activationKey.slice(0, 14),
        tenantId: dto.tenantId,
        configProfileId: dto.configProfileId,
        maxDevices: dto.maxDevices,
        notes: dto.notes,
        createdByAdminId: req.user.sub
      },
      include: { tenant: true, configProfile: true }
    });
    await this.audit.log({ actorAdminId: req.user.sub, actorEmail: req.user.email, action: "license.enterprise.generate", targetType: "EnterpriseLicenseKey", targetId: key.id });
    return { ...key, activationKey };
  }

  @Get("tenants")
  tenants() {
    return this.prisma.tenant.findMany({ orderBy: { name: "asc" }, include: { configProfile: true, partner: true } });
  }

  @Post("tenants")
  tenantsCreate(@Body() dto: { name: string; slug: string; partnerId?: string; configProfileId?: string }) {
    return this.prisma.tenant.create({ data: dto });
  }

  @Get("config-profiles")
  configProfiles() {
    return this.prisma.configProfile.findMany({ orderBy: { updatedAt: "desc" } });
  }

  @Post("config-profiles")
  async createConfig(@Body() dto: ConfigDto, @Req() req: any) {
    const profile = await this.prisma.configProfile.create({ data: this.cleanConfig(dto) as any });
    await this.audit.log({ actorAdminId: req.user.sub, actorEmail: req.user.email, action: "config.create", targetType: "ConfigProfile", targetId: profile.id });
    return profile;
  }

  @Patch("config-profiles/:id")
  async updateConfig(@Param("id") id: string, @Body() dto: ConfigDto, @Req() req: any) {
    const profile = await this.prisma.configProfile.update({ where: { id }, data: this.cleanConfig(dto) as any });
    await this.audit.log({ actorAdminId: req.user.sub, actorEmail: req.user.email, action: "config.update", targetType: "ConfigProfile", targetId: id });
    return profile;
  }

  @Get("templates")
  templatesList() {
    return this.prisma.template.findMany({ orderBy: { updatedAt: "desc" }, include: { category: true, versions: { orderBy: { createdAt: "desc" } } } });
  }

  @Get("template-categories")
  categories() {
    return this.prisma.templateCategory.findMany({ orderBy: { title: "asc" } });
  }

  @Post("templates")
  async createTemplate(@Body() dto: TemplateDto, @Req() req: any) {
    this.templates.validateYamlContent(dto.yamlContent);
    const template = await this.prisma.template.create({
      data: {
        title: dto.title,
        shortDescription: dto.shortDescription,
        categoryId: dto.categoryId || undefined,
        language: dto.language,
        icon: dto.icon,
        tags: dto.tags,
        tenantId: dto.tenantId || undefined,
        versions: { create: { version: dto.version, yamlContent: dto.yamlContent, createdByAdminId: req.user.sub } }
      },
      include: { versions: true }
    });
    await this.audit.log({ actorAdminId: req.user.sub, actorEmail: req.user.email, action: "template.create", targetType: "Template", targetId: template.id });
    return template;
  }

  @Patch("templates/:id")
  async updateTemplate(@Param("id") id: string, @Body() dto: Partial<TemplateDto>, @Req() req: any) {
    const template = await this.prisma.template.update({
      where: { id },
      data: {
        title: dto.title,
        shortDescription: dto.shortDescription,
        categoryId: dto.categoryId || undefined,
        language: dto.language,
        icon: dto.icon,
        tags: dto.tags as any,
        tenantId: dto.tenantId || undefined
      }
    });
    if (dto.version && dto.yamlContent) {
      this.templates.validateYamlContent(dto.yamlContent);
      await this.prisma.templateVersion.create({ data: { templateId: id, version: dto.version, yamlContent: dto.yamlContent, createdByAdminId: req.user.sub } });
    }
    await this.audit.log({ actorAdminId: req.user.sub, actorEmail: req.user.email, action: "template.update", targetType: "Template", targetId: id });
    return template;
  }

  @Post("templates/:id/publish/:versionId")
  publish(@Param("id") id: string, @Param("versionId") versionId: string, @Req() req: any) {
    return this.templates.publish(id, versionId, { id: req.user.sub, email: req.user.email });
  }

  @Patch("templates/:id/archive")
  archive(@Param("id") id: string, @Req() req: any) {
    this.audit.log({ actorAdminId: req.user.sub, actorEmail: req.user.email, action: "template.archive", targetType: "Template", targetId: id });
    return this.prisma.template.update({ where: { id }, data: { state: "archived" } });
  }

  @Get("activations")
  activations() {
    return this.prisma.deviceActivation.findMany({ orderBy: { lastCheckIn: "desc" }, include: { singleLicenseKey: true, enterpriseLicenseKey: { include: { tenant: true } } } });
  }

  @Get("audit-logs")
  auditLogs() {
    return this.prisma.activationAuditLog.findMany({ orderBy: { createdAt: "desc" }, take: 200 });
  }

  private cleanConfig(dto: ConfigDto) {
    return {
      ...dto,
      featureFlags: dto.featureFlags ?? {},
      allowedProviderRestrictions: dto.allowedProviderRestrictions ?? []
    };
  }
}
