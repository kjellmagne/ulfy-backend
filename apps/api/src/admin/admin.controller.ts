import { Body, Controller, Get, Param, Patch, Post, Req, UseGuards } from "@nestjs/common";
import { IsArray, IsEmail, IsInt, IsOptional, IsString, Min, MinLength } from "class-validator";
import { ApiBearerAuth, ApiBody, ApiOkResponse, ApiOperation, ApiParam, ApiProperty, ApiTags, ApiUnauthorizedResponse } from "@nestjs/swagger";
import { PrismaService } from "../prisma/prisma.service";
import { AdminGuard } from "../auth/admin.guard";
import { createActivationKey, sha256 } from "../common/crypto";
import { AuditService } from "../common/audit.service";
import { TemplatesService } from "../templates/templates.service";

class SingleKeyDto {
  @ApiProperty({ example: "Ola Nordmann" })
  @IsString()
  purchaserFullName!: string;

  @ApiProperty({ example: "ola@example.com" })
  @IsEmail()
  purchaserEmail!: string;

  @ApiProperty({ required: false, example: "2026-04-28T00:00:00.000Z" })
  @IsOptional()
  @IsString()
  purchaseDate?: string;

  @ApiProperty({ required: false, example: "Purchased through selected solution partner." })
  @IsOptional()
  @IsString()
  notes?: string;

  @ApiProperty({ required: false, example: "partner-uuid" })
  @IsOptional()
  @IsString()
  partnerId?: string;
}

class EnterpriseKeyDto {
  @ApiProperty({ example: "tenant-uuid" })
  @IsString()
  tenantId!: string;

  @ApiProperty({ example: "config-profile-uuid" })
  @IsString()
  configProfileId!: string;

  @ApiProperty({ required: false, example: 100 })
  @IsOptional()
  @IsInt()
  @Min(1)
  maxDevices?: number;

  @ApiProperty({ required: false, example: "Enterprise pilot key." })
  @IsOptional()
  @IsString()
  notes?: string;
}

class ConfigDto {
  @ApiProperty({ example: "Default Enterprise Profile" })
  @IsString()
  name!: string;

  @ApiProperty({ required: false, example: "Central configuration for selected enterprise tenant." })
  @IsOptional()
  description?: string;

  @ApiProperty({ required: false, example: "openai-compatible" })
  speechProviderType?: string;
  @ApiProperty({ required: false, example: "https://speech.example.internal/v1/audio/transcriptions" })
  speechEndpointUrl?: string;
  @ApiProperty({ required: false, example: "whisper-large-v3" })
  speechModelName?: string;
  @ApiProperty({ required: false, example: true })
  privacyControlEnabled?: boolean;
  @ApiProperty({ required: false, example: true })
  piiControlEnabled?: boolean;
  @ApiProperty({ required: false, example: "https://presidio.example.internal" })
  presidioEndpointUrl?: string;
  @ApiProperty({ required: false, example: "secret://ulfy/presidio" })
  presidioSecretRef?: string;
  @ApiProperty({ required: false, example: "openai-compatible" })
  privacyReviewProviderType?: string;
  @ApiProperty({ required: false, example: "https://privacy.example.internal/v1/chat/completions" })
  privacyReviewEndpointUrl?: string;
  @ApiProperty({ required: false, example: "privacy-review-v1" })
  privacyReviewModel?: string;
  @ApiProperty({ required: false, example: "openai-compatible" })
  documentGenerationProviderType?: string;
  @ApiProperty({ required: false, example: "https://docs.example.internal/v1/chat/completions" })
  documentGenerationEndpointUrl?: string;
  @ApiProperty({ required: false, example: "docgen-v1" })
  documentGenerationModel?: string;
  @ApiProperty({ required: false, example: "https://kvasetech.com/backend/api/v1/templates/manifest" })
  templateRepositoryUrl?: string;
  @ApiProperty({ required: false, example: "https://telemetry.example.internal/events" })
  telemetryEndpointUrl?: string;
  @ApiProperty({ required: false, example: { enterpriseTemplates: true, privacyReview: true } })
  featureFlags?: Record<string, boolean>;
  @ApiProperty({ required: false, example: ["openai-compatible", "internal"] })
  allowedProviderRestrictions?: string[];
  @ApiProperty({ required: false, nullable: true, example: null })
  defaultTemplateId?: string | null;
  [key: string]: unknown;
}

class TemplateDto {
  @ApiProperty({ example: "Personlig diktat / logg" })
  @IsString()
  title!: string;

  @ApiProperty({ example: "Kort beskrivelse" })
  @IsString()
  shortDescription!: string;

  @ApiProperty({ required: false, example: "template-category-uuid" })
  @IsOptional()
  @IsString()
  categoryId?: string;

  @ApiProperty({ example: "nb-NO" })
  @IsString()
  language!: string;

  @ApiProperty({ example: "waveform.and.mic" })
  @IsString()
  icon!: string;

  @ApiProperty({ example: ["dictation", "personal"], type: [String] })
  @IsArray()
  tags!: string[];

  @ApiProperty({ required: false, example: "tenant-uuid" })
  @IsOptional()
  @IsString()
  tenantId?: string;

  @ApiProperty({ example: "1.0.0" })
  @IsString()
  @MinLength(1)
  version!: string;

  @ApiProperty({ example: "title: Personlig diktat / logg\nlanguage: nb-NO\nsections:\n  - id: context\n    title: Kontekst\n    prompt: Oppsummer relevant kontekst kort.\n" })
  @IsString()
  yamlContent!: string;
}

class TenantDto {
  @ApiProperty({ example: "Acme Health" })
  name!: string;
  @ApiProperty({ example: "acme-health" })
  slug!: string;
  @ApiProperty({ required: false, example: "partner-uuid" })
  partnerId?: string;
  @ApiProperty({ required: false, example: "config-profile-uuid" })
  configProfileId?: string;
}

@ApiTags("Admin")
@ApiBearerAuth()
@ApiUnauthorizedResponse({ description: "Missing or invalid admin bearer token." })
@UseGuards(AdminGuard)
@Controller("admin")
export class AdminController {
  constructor(private readonly prisma: PrismaService, private readonly audit: AuditService, private readonly templates: TemplatesService) {}

  @Get("me")
  @ApiOperation({ summary: "Current admin user" })
  @ApiOkResponse({ description: "Decoded admin JWT claims.", schema: { example: { sub: "admin-uuid", email: "admin@ulfy.local", role: "superadmin", partnerId: null } } })
  me(@Req() req: any) {
    return req.user;
  }

  @Get("overview")
  @ApiOperation({ summary: "Admin dashboard overview", description: "Counts and latest audit entries for the internal admin dashboard." })
  @ApiOkResponse({ description: "Overview counters and recent audit logs.", schema: { example: { singleKeys: 12, enterpriseKeys: 3, activations: 8, templates: 5, audits: [] } } })
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
  @ApiOperation({ summary: "List single-user license keys", description: "Returns single-user key records. Full keys are never returned after creation; only hashed storage and key prefixes are retained." })
  @ApiOkResponse({ description: "Single-user license key list." })
  singleKeys() {
    return this.prisma.singleLicenseKey.findMany({ orderBy: { createdAt: "desc" }, include: { partner: true, activations: true } });
  }

  @Post("single-keys")
  @ApiOperation({ summary: "Generate single-user activation key", description: "Creates a display-once activation key. The response includes activationKey once; store/copy it immediately." })
  @ApiBody({ type: SingleKeyDto })
  @ApiOkResponse({ description: "Single-user key generated.", schema: { example: { id: "license-uuid", activationKey: "ULFY-S-ABC123-DEF456-GHI789-JKL012", keyPrefix: "ULFY-S-ABC123", purchaserFullName: "Ola Nordmann", purchaserEmail: "ola@example.com", status: "active" } } })
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
  @ApiOperation({ summary: "Revoke single-user license key" })
  @ApiParam({ name: "id", description: "SingleLicenseKey UUID." })
  @ApiOkResponse({ description: "License key revoked." })
  async revokeSingle(@Param("id") id: string, @Req() req: any) {
    const key = await this.prisma.singleLicenseKey.update({ where: { id }, data: { status: "revoked" } });
    await this.prisma.deviceActivation.updateMany({ where: { singleLicenseKeyId: id }, data: { status: "revoked" } });
    await this.audit.log({ actorAdminId: req.user.sub, actorEmail: req.user.email, action: "license.single.revoke", targetType: "SingleLicenseKey", targetId: id });
    return key;
  }

  @Patch("single-keys/:id/reset")
  @ApiOperation({ summary: "Reset single-user device binding", description: "Deletes device activations for the single-user key and makes it active/unbound again." })
  @ApiParam({ name: "id", description: "SingleLicenseKey UUID." })
  @ApiOkResponse({ description: "License key reset." })
  async resetSingle(@Param("id") id: string, @Req() req: any) {
    await this.prisma.deviceActivation.deleteMany({ where: { singleLicenseKeyId: id } });
    const key = await this.prisma.singleLicenseKey.update({ where: { id }, data: { deviceIdentifier: null, activatedAt: null, lastCheckIn: null, status: "active" } });
    await this.audit.log({ actorAdminId: req.user.sub, actorEmail: req.user.email, action: "license.single.reset", targetType: "SingleLicenseKey", targetId: id });
    return key;
  }

  @Get("enterprise-keys")
  @ApiOperation({ summary: "List enterprise license keys" })
  @ApiOkResponse({ description: "Enterprise license key list with tenant/config profile info." })
  enterpriseKeys() {
    return this.prisma.enterpriseLicenseKey.findMany({ orderBy: { createdAt: "desc" }, include: { tenant: true, configProfile: true, activations: true } });
  }

  @Post("enterprise-keys")
  @ApiOperation({ summary: "Generate enterprise activation key", description: "Creates a display-once enterprise activation key linked to a tenant and config profile." })
  @ApiBody({ type: EnterpriseKeyDto })
  @ApiOkResponse({ description: "Enterprise key generated.", schema: { example: { id: "enterprise-key-uuid", activationKey: "ULFY-E-ABC123-DEF456-GHI789-JKL012", keyPrefix: "ULFY-E-ABC123", status: "active", maxDevices: 100 } } })
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
  @ApiOperation({ summary: "List tenants" })
  @ApiOkResponse({ description: "Tenant list." })
  tenants() {
    return this.prisma.tenant.findMany({ orderBy: { name: "asc" }, include: { configProfile: true, partner: true } });
  }

  @Post("tenants")
  @ApiOperation({ summary: "Create tenant" })
  @ApiBody({ type: TenantDto })
  @ApiOkResponse({ description: "Tenant created." })
  tenantsCreate(@Body() dto: TenantDto) {
    return this.prisma.tenant.create({ data: dto });
  }

  @Get("config-profiles")
  @ApiOperation({ summary: "List config profiles" })
  @ApiOkResponse({ description: "Config profile list." })
  configProfiles() {
    return this.prisma.configProfile.findMany({ orderBy: { updatedAt: "desc" } });
  }

  @Post("config-profiles")
  @ApiOperation({ summary: "Create config profile", description: "Creates a manually managed enterprise configuration profile." })
  @ApiBody({ type: ConfigDto })
  @ApiOkResponse({ description: "Config profile created." })
  async createConfig(@Body() dto: ConfigDto, @Req() req: any) {
    const profile = await this.prisma.configProfile.create({ data: this.cleanConfig(dto) as any });
    await this.audit.log({ actorAdminId: req.user.sub, actorEmail: req.user.email, action: "config.create", targetType: "ConfigProfile", targetId: profile.id });
    return profile;
  }

  @Patch("config-profiles/:id")
  @ApiOperation({ summary: "Update config profile" })
  @ApiParam({ name: "id", description: "ConfigProfile UUID." })
  @ApiBody({ type: ConfigDto })
  @ApiOkResponse({ description: "Config profile updated." })
  async updateConfig(@Param("id") id: string, @Body() dto: ConfigDto, @Req() req: any) {
    const profile = await this.prisma.configProfile.update({ where: { id }, data: this.cleanConfig(dto) as any });
    await this.audit.log({ actorAdminId: req.user.sub, actorEmail: req.user.email, action: "config.update", targetType: "ConfigProfile", targetId: id });
    return profile;
  }

  @Get("templates")
  @ApiOperation({ summary: "Admin template list", description: "Lists templates with category and version history for the admin UI." })
  @ApiOkResponse({ description: "Template list." })
  templatesList() {
    return this.prisma.template.findMany({ orderBy: { updatedAt: "desc" }, include: { category: true, versions: { orderBy: { createdAt: "desc" } } } });
  }

  @Get("template-categories")
  @ApiOperation({ summary: "List template categories" })
  @ApiOkResponse({ description: "Template categories." })
  categories() {
    return this.prisma.templateCategory.findMany({ orderBy: { title: "asc" } });
  }

  @Post("templates")
  @ApiOperation({ summary: "Create template draft/version", description: "Creates a template and initial YAML version after YAML/schema validation." })
  @ApiBody({ type: TemplateDto })
  @ApiOkResponse({ description: "Template created." })
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
  @ApiOperation({ summary: "Update template metadata or add a new YAML version" })
  @ApiParam({ name: "id", description: "Template UUID." })
  @ApiBody({ type: TemplateDto })
  @ApiOkResponse({ description: "Template updated." })
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
  @ApiOperation({ summary: "Publish template version", description: "Validates YAML schema, marks selected version published, and updates the template publishedVersionId." })
  @ApiParam({ name: "id", description: "Template UUID." })
  @ApiParam({ name: "versionId", description: "TemplateVersion UUID." })
  @ApiOkResponse({ description: "Template version published.", schema: { example: { success: true } } })
  publish(@Param("id") id: string, @Param("versionId") versionId: string, @Req() req: any) {
    return this.templates.publish(id, versionId, { id: req.user.sub, email: req.user.email });
  }

  @Patch("templates/:id/archive")
  @ApiOperation({ summary: "Archive template" })
  @ApiParam({ name: "id", description: "Template UUID." })
  @ApiOkResponse({ description: "Template archived." })
  archive(@Param("id") id: string, @Req() req: any) {
    this.audit.log({ actorAdminId: req.user.sub, actorEmail: req.user.email, action: "template.archive", targetType: "Template", targetId: id });
    return this.prisma.template.update({ where: { id }, data: { state: "archived" } });
  }

  @Get("activations")
  @ApiOperation({ summary: "List device activations" })
  @ApiOkResponse({ description: "Device activation list." })
  activations() {
    return this.prisma.deviceActivation.findMany({ orderBy: { lastCheckIn: "desc" }, include: { singleLicenseKey: true, enterpriseLicenseKey: { include: { tenant: true } } } });
  }

  @Get("audit-logs")
  @ApiOperation({ summary: "List audit logs", description: "Returns latest activation/config/license/template audit entries." })
  @ApiOkResponse({ description: "Audit log list." })
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
