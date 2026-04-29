import { Body, ConflictException, Controller, Delete, ForbiddenException, Get, Param, Patch, Post, Req, UseGuards } from "@nestjs/common";
import { IsArray, IsBoolean, IsEmail, IsIn, IsInt, IsObject, IsOptional, IsString, Min, MinLength } from "class-validator";
import { ApiBearerAuth, ApiBody, ApiConflictResponse, ApiOkResponse, ApiOperation, ApiParam, ApiProperty, ApiTags, ApiUnauthorizedResponse } from "@nestjs/swagger";
import * as bcrypt from "bcryptjs";
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

  @ApiProperty({ required: false, example: "2027-04-29T00:00:00.000Z" })
  @IsOptional()
  @IsString()
  maintenanceUntil?: string;

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

  @ApiProperty({ required: false, example: "2027-04-29T00:00:00.000Z" })
  @IsOptional()
  @IsString()
  maintenanceUntil?: string;

  @ApiProperty({ required: false, example: "Enterprise pilot key." })
  @IsOptional()
  @IsString()
  notes?: string;
}

export class ConfigDto {
  @ApiProperty({ example: "Default Enterprise Profile" })
  @IsString()
  name!: string;

  @ApiProperty({ required: false, example: "partner-uuid" })
  @IsOptional()
  @IsString()
  partnerId?: string;

  @ApiProperty({ required: false, example: "Central configuration for selected enterprise tenant." })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({ required: false, example: "openai-compatible" })
  @IsOptional()
  @IsString()
  speechProviderType?: string;
  @ApiProperty({ required: false, example: "https://speech.example.internal/v1/audio/transcriptions" })
  @IsOptional()
  @IsString()
  speechEndpointUrl?: string;
  @ApiProperty({ required: false, example: "whisper-large-v3" })
  @IsOptional()
  @IsString()
  speechModelName?: string;
  @ApiProperty({ required: false, example: "sk-speech-provider-key", description: "Optional managed speech provider API key. Prefer internal gateway endpoints or short-lived tenant-scoped keys when possible." })
  @IsOptional()
  @IsString()
  speechApiKey?: string;
  @ApiProperty({ required: false, example: true })
  @IsOptional()
  @IsBoolean()
  privacyControlEnabled?: boolean;
  @ApiProperty({ required: false, example: true })
  @IsOptional()
  @IsBoolean()
  piiControlEnabled?: boolean;
  @ApiProperty({ required: false, example: "https://presidio.example.internal" })
  @IsOptional()
  @IsString()
  presidioEndpointUrl?: string;
  @ApiProperty({ required: false, example: "secret://ulfy/presidio" })
  @IsOptional()
  @IsString()
  presidioSecretRef?: string;
  @ApiProperty({ required: false, example: "openai-compatible" })
  @IsOptional()
  @IsString()
  privacyReviewProviderType?: string;
  @ApiProperty({ required: false, example: "https://privacy.example.internal/v1/chat/completions" })
  @IsOptional()
  @IsString()
  privacyReviewEndpointUrl?: string;
  @ApiProperty({ required: false, example: "privacy-review-v1" })
  @IsOptional()
  @IsString()
  privacyReviewModel?: string;
  @ApiProperty({ required: false, example: "openai-compatible" })
  @IsOptional()
  @IsString()
  documentGenerationProviderType?: string;
  @ApiProperty({ required: false, example: "https://docs.example.internal/v1/chat/completions" })
  @IsOptional()
  @IsString()
  documentGenerationEndpointUrl?: string;
  @ApiProperty({ required: false, example: "docgen-v1" })
  @IsOptional()
  @IsString()
  documentGenerationModel?: string;
  @ApiProperty({ required: false, example: "sk-document-provider-key", description: "Optional managed document-generation provider API key. Prefer internal gateway endpoints or short-lived tenant-scoped keys when possible." })
  @IsOptional()
  @IsString()
  documentGenerationApiKey?: string;
  @ApiProperty({ required: false, example: "https://kvasetech.com/backend/api/v1/templates/manifest" })
  @IsOptional()
  @IsString()
  templateRepositoryUrl?: string;
  @ApiProperty({ required: false, example: "https://telemetry.example.internal/events" })
  @IsOptional()
  @IsString()
  telemetryEndpointUrl?: string;
  @ApiProperty({ required: false, example: { enterpriseTemplates: true, privacyReview: true } })
  @IsOptional()
  @IsObject()
  featureFlags?: Record<string, boolean>;
  @ApiProperty({ required: false, example: ["openai-compatible", "internal"] })
  @IsOptional()
  @IsArray()
  allowedProviderRestrictions?: string[];
  @ApiProperty({
    required: false,
    description: "Admin-side provider profile metadata, privacy classifications and future app connection profile settings. Not required by the current mobile payload.",
    example: {
      speech: { selected: "azure", azure: { endpointURL: "http://192.168.222.171:5000" } },
      formatter: { selected: "openai_compatible", privacyEmphasis: "managed" },
      privacyReview: { selected: "local_heuristic" },
      presidio: { scoreThreshold: 0.7, detectEmail: true, detectPerson: true }
    }
  })
  @IsOptional()
  @IsObject()
  providerProfiles?: Record<string, unknown>;
  @ApiProperty({
    required: false,
    description: "Admin-side policy switches, such as whether users may override provider selections.",
    example: { allowPolicyOverride: false, userMayChangeSpeechProvider: false, userMayChangeFormatter: false, externalFormattersAllowed: false }
  })
  @IsOptional()
  @IsObject()
  managedPolicy?: Record<string, unknown>;
  @ApiProperty({ required: false, nullable: true, example: null })
  @IsOptional()
  @IsString()
  defaultTemplateId?: string | null;
  [key: string]: unknown;
}

class CloneConfigDto {
  @ApiProperty({ required: false, example: "Copy of Default Enterprise Profile" })
  @IsOptional()
  @IsString()
  name?: string;
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

class TemplateFamilyDto {
  @ApiProperty({ example: "Personlig diktat / logg" })
  @IsString()
  title!: string;

  @ApiProperty({ example: "Core personal dictation template." })
  @IsString()
  shortDescription!: string;

  @ApiProperty({ required: false, example: "template-category-uuid" })
  @IsOptional()
  @IsString()
  categoryId?: string;

  @ApiProperty({ required: false, example: "waveform.and.mic" })
  @IsOptional()
  @IsString()
  icon?: string;

  @ApiProperty({ required: false, example: ["dictation", "personal"], type: [String] })
  @IsOptional()
  @IsArray()
  tags?: string[];

  @ApiProperty({ required: false, example: false, description: "When true, all enterprise tenants can see this family." })
  @IsOptional()
  @IsBoolean()
  isGlobal?: boolean;
}

class TemplateVariantDto {
  @ApiProperty({ example: "nb-NO" })
  @IsString()
  language!: string;

  @ApiProperty({ description: "One language-specific YAML template using the iOS app schema." })
  @IsString()
  yamlContent!: string;

  @ApiProperty({ required: false, description: "Sample transcript used by manual preview generation." })
  @IsOptional()
  @IsString()
  sampleTranscript?: string;
}

class TemplateDraftDto {
  @ApiProperty({ description: "Mutable draft YAML using the iOS app schema." })
  @IsString()
  yamlContent!: string;

  @ApiProperty({ required: false, description: "Sample transcript used by manual preview generation." })
  @IsOptional()
  @IsString()
  sampleTranscript?: string;
}

class TemplatePublishDto {
  @ApiProperty({ required: false, example: "patch", enum: ["patch", "minor", "major"] })
  @IsOptional()
  @IsIn(["patch", "minor", "major"])
  bump?: "patch" | "minor" | "major";

  @ApiProperty({ required: false, example: "1.0.0", description: "Exact semver override. Used mostly for first publish." })
  @IsOptional()
  @IsString()
  version?: string;
}

class TemplateEntitlementDto {
  @ApiProperty({ example: "tenant-uuid" })
  @IsString()
  tenantId!: string;
}

class TemplateAiAssistDto {
  @ApiProperty({ example: "Follow-up conversation with a user after a service meeting." })
  @IsString()
  useCase!: string;

  @ApiProperty({ required: false, example: "nb-NO" })
  @IsOptional()
  @IsString()
  language?: string;

  @ApiProperty({ required: false, example: "oppfolgingssamtale" })
  @IsOptional()
  @IsString()
  category?: string;

  @ApiProperty({ required: false, example: "Oppfølgingssamtale" })
  @IsOptional()
  @IsString()
  title?: string;

  @ApiProperty({ required: false, example: "arrow.triangle.2.circlepath" })
  @IsOptional()
  @IsString()
  icon?: string;
}

class TemplateCategoryDto {
  @ApiProperty({ example: "oppfolgingssamtale" })
  @IsString()
  slug!: string;

  @ApiProperty({ example: "Oppfølgingssamtale" })
  @IsString()
  title!: string;

  @ApiProperty({ required: false, example: "Templates for structured follow-up conversations." })
  @IsOptional()
  @IsString()
  description?: string;
}

class TemplateSectionPresetDto {
  @ApiProperty({ example: "action-items" })
  @IsString()
  slug!: string;

  @ApiProperty({ example: "Action items" })
  @IsString()
  title!: string;

  @ApiProperty({ example: "Extract follow-up tasks with owner and deadline when present." })
  @IsString()
  purpose!: string;

  @ApiProperty({ required: false, example: "table" })
  @IsOptional()
  @IsString()
  format?: string;

  @ApiProperty({ required: false, example: false })
  @IsOptional()
  @IsBoolean()
  required?: boolean;

  @ApiProperty({ required: false, example: ["task", "owner", "deadline"], type: [String] })
  @IsOptional()
  @IsArray()
  extractionHints?: string[];

  @ApiProperty({ required: false, example: 30 })
  @IsOptional()
  @IsInt()
  sortOrder?: number;
}

class TenantDto {
  @ApiProperty({ example: "Acme Health" })
  @IsString()
  name!: string;

  @ApiProperty({ example: "acme-health" })
  @IsString()
  slug!: string;

  @ApiProperty({ required: false, example: "Acme Health AS" })
  @IsOptional()
  @IsString()
  legalName?: string;

  @ApiProperty({ required: false, example: "999888777" })
  @IsOptional()
  @IsString()
  organizationNumber?: string;

  @ApiProperty({ required: false, example: "Kari Nordmann" })
  @IsOptional()
  @IsString()
  contactName?: string;

  @ApiProperty({ required: false, example: "kari@acme.example" })
  @IsOptional()
  @IsEmail()
  contactEmail?: string;

  @ApiProperty({ required: false, example: "+47 900 00 000" })
  @IsOptional()
  @IsString()
  contactPhone?: string;

  @ApiProperty({ required: false, example: "billing@acme.example" })
  @IsOptional()
  @IsEmail()
  billingEmail?: string;

  @ApiProperty({ required: false, example: "Storgata 1" })
  @IsOptional()
  @IsString()
  addressLine1?: string;

  @ApiProperty({ required: false, example: "Floor 4" })
  @IsOptional()
  @IsString()
  addressLine2?: string;

  @ApiProperty({ required: false, example: "0155" })
  @IsOptional()
  @IsString()
  postalCode?: string;

  @ApiProperty({ required: false, example: "Oslo" })
  @IsOptional()
  @IsString()
  city?: string;

  @ApiProperty({ required: false, example: "NO" })
  @IsOptional()
  @IsString()
  country?: string;

  @ApiProperty({ required: false, example: "active" })
  @IsOptional()
  @IsString()
  status?: string;

  @ApiProperty({ required: false, example: "Enterprise customer managed by staff admins." })
  @IsOptional()
  @IsString()
  notes?: string;

  @ApiProperty({ required: false, example: "partner-uuid" })
  @IsOptional()
  @IsString()
  partnerId?: string;

  @ApiProperty({ required: false, example: "config-profile-uuid" })
  @IsOptional()
  @IsString()
  configProfileId?: string;
}

class PartnerDto {
  @ApiProperty({ example: "Nordic Solutions AS" })
  @IsString()
  name!: string;

  @ApiProperty({ required: false, example: "partner@example.no" })
  @IsOptional()
  @IsEmail()
  email?: string;

  @ApiProperty({ required: false, example: "Selected solution partner for northern Norway." })
  @IsOptional()
  @IsString()
  notes?: string;
}

class AdminUserCreateDto {
  @ApiProperty({ example: "partner.admin@example.no" })
  @IsEmail()
  email!: string;

  @ApiProperty({ example: "Partner Admin" })
  @IsString()
  fullName!: string;

  @ApiProperty({ example: "partner_admin", enum: ["superadmin", "staff_admin", "partner_admin"] })
  @IsIn(["superadmin", "staff_admin", "partner_admin"])
  role!: "superadmin" | "staff_admin" | "partner_admin";

  @ApiProperty({ required: false, example: "partner-uuid" })
  @IsOptional()
  @IsString()
  partnerId?: string;

  @ApiProperty({ example: "ChangeMe123!", minLength: 8 })
  @IsString()
  @MinLength(8)
  password!: string;
}

class AdminUserUpdateDto {
  @ApiProperty({ required: false, example: "partner.admin@example.no" })
  @IsOptional()
  @IsEmail()
  email?: string;

  @ApiProperty({ required: false, example: "Partner Admin" })
  @IsOptional()
  @IsString()
  fullName?: string;

  @ApiProperty({ required: false, example: "partner_admin", enum: ["superadmin", "staff_admin", "partner_admin"] })
  @IsOptional()
  @IsIn(["superadmin", "staff_admin", "partner_admin"])
  role?: "superadmin" | "staff_admin" | "partner_admin";

  @ApiProperty({ required: false, example: "partner-uuid" })
  @IsOptional()
  @IsString()
  partnerId?: string | null;

  @ApiProperty({ required: false, example: "ChangeMe123!", minLength: 8 })
  @IsOptional()
  @IsString()
  @MinLength(8)
  password?: string;
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
  async me(@Req() req: any) {
    const user = await this.prisma.adminUser.findUnique({ where: { id: req.user.sub }, include: { partner: true } });
    return user ? { id: user.id, email: user.email, fullName: user.fullName, role: user.role, partnerId: user.partnerId, partner: user.partner } : req.user;
  }

  @Get("partners")
  @ApiOperation({ summary: "List solution partners", description: "Superadmins and staff see all partners. Partner admins see only their assigned partner." })
  @ApiOkResponse({ description: "Partner list." })
  partners(@Req() req: any) {
    const partnerId = this.scopedPartnerId(req);
    return this.prisma.partner.findMany({
      where: partnerId ? { id: partnerId } : {},
      orderBy: { name: "asc" },
      include: {
        tenants: { select: { id: true, name: true, slug: true, status: true } },
        admins: { select: { id: true, email: true, fullName: true, role: true, partnerId: true, createdAt: true } }
      }
    });
  }

  @Post("partners")
  @ApiOperation({ summary: "Create solution partner", description: "Superadmin only." })
  @ApiBody({ type: PartnerDto })
  @ApiOkResponse({ description: "Partner created." })
  async createPartner(@Body() dto: PartnerDto, @Req() req: any) {
    this.requireSuperadmin(req);
    const partner = await this.prisma.partner.create({ data: this.cleanPartner(dto) as any });
    await this.audit.log({ actorAdminId: req.user.sub, actorEmail: req.user.email, action: "partner.create", targetType: "Partner", targetId: partner.id });
    return partner;
  }

  @Patch("partners/:id")
  @ApiOperation({ summary: "Update solution partner", description: "Superadmin only." })
  @ApiParam({ name: "id", description: "Partner UUID." })
  @ApiBody({ type: PartnerDto })
  @ApiOkResponse({ description: "Partner updated." })
  async updatePartner(@Param("id") id: string, @Body() dto: Partial<PartnerDto>, @Req() req: any) {
    this.requireSuperadmin(req);
    const partner = await this.prisma.partner.update({ where: { id }, data: this.cleanPartner(dto) });
    await this.audit.log({ actorAdminId: req.user.sub, actorEmail: req.user.email, action: "partner.update", targetType: "Partner", targetId: id });
    return partner;
  }

  @Delete("partners/:id")
  @ApiOperation({ summary: "Delete solution partner", description: "Superadmin only. Partners in use by users, tenants, keys, or config profiles cannot be deleted." })
  @ApiParam({ name: "id", description: "Partner UUID." })
  @ApiOkResponse({ description: "Partner deleted.", schema: { example: { success: true } } })
  @ApiConflictResponse({ description: "Partner is in use and cannot be deleted." })
  async deletePartner(@Param("id") id: string, @Req() req: any) {
    this.requireSuperadmin(req);
    const [admins, tenants, singleKeys, enterpriseKeys, configProfiles] = await Promise.all([
      this.prisma.adminUser.count({ where: { partnerId: id } }),
      this.prisma.tenant.count({ where: { partnerId: id } }),
      this.prisma.singleLicenseKey.count({ where: { partnerId: id } }),
      this.prisma.enterpriseLicenseKey.count({ where: { partnerId: id } }),
      this.prisma.configProfile.count({ where: { partnerId: id } })
    ]);
    if (admins || tenants || singleKeys || enterpriseKeys || configProfiles) {
      throw new ConflictException("Cannot delete partner while users, tenants, keys, or config profiles reference it.");
    }
    await this.prisma.partner.delete({ where: { id } });
    await this.audit.log({ actorAdminId: req.user.sub, actorEmail: req.user.email, action: "partner.delete", targetType: "Partner", targetId: id });
    return { success: true };
  }

  @Get("users")
  @ApiOperation({ summary: "List admin portal users", description: "Superadmin only." })
  @ApiOkResponse({ description: "Admin portal users." })
  users(@Req() req: any) {
    this.requireSuperadmin(req);
    return this.prisma.adminUser.findMany({ orderBy: { createdAt: "desc" }, include: { partner: true } }).then((users) => users.map((user) => this.withoutPassword(user)));
  }

  @Post("users")
  @ApiOperation({ summary: "Create admin portal user", description: "Superadmin only. Partner admins must be assigned to a solution partner." })
  @ApiBody({ type: AdminUserCreateDto })
  @ApiOkResponse({ description: "Admin user created." })
  async createUser(@Body() dto: AdminUserCreateDto, @Req() req: any) {
    this.requireSuperadmin(req);
    const data = await this.cleanAdminUser(dto, true);
    const user = await this.prisma.adminUser.create({ data, include: { partner: true } });
    await this.audit.log({ actorAdminId: req.user.sub, actorEmail: req.user.email, action: "admin_user.create", targetType: "AdminUser", targetId: user.id });
    return this.withoutPassword(user);
  }

  @Patch("users/:id")
  @ApiOperation({ summary: "Update admin portal user", description: "Superadmin only." })
  @ApiParam({ name: "id", description: "AdminUser UUID." })
  @ApiBody({ type: AdminUserUpdateDto })
  @ApiOkResponse({ description: "Admin user updated." })
  async updateUser(@Param("id") id: string, @Body() dto: AdminUserUpdateDto, @Req() req: any) {
    this.requireSuperadmin(req);
    const existing = await this.prisma.adminUser.findUnique({ where: { id } });
    const effectiveRole = dto.role ?? existing?.role;
    const effectivePartnerId = dto.partnerId === undefined ? existing?.partnerId : dto.partnerId;
    if (effectiveRole === "partner_admin" && !effectivePartnerId) {
      throw new ConflictException("Partner admins must be assigned to a solution partner.");
    }
    if (dto.role && dto.role !== "superadmin") await this.ensureAnotherSuperadmin(id);
    const data = await this.cleanAdminUser(dto, false);
    const user = await this.prisma.adminUser.update({ where: { id }, data, include: { partner: true } });
    await this.audit.log({ actorAdminId: req.user.sub, actorEmail: req.user.email, action: "admin_user.update", targetType: "AdminUser", targetId: id });
    return this.withoutPassword(user);
  }

  @Delete("users/:id")
  @ApiOperation({ summary: "Delete admin portal user", description: "Superadmin only." })
  @ApiParam({ name: "id", description: "AdminUser UUID." })
  @ApiOkResponse({ description: "Admin user deleted.", schema: { example: { success: true } } })
  async deleteUser(@Param("id") id: string, @Req() req: any) {
    this.requireSuperadmin(req);
    if (id === req.user.sub) throw new ConflictException("You cannot delete your own admin user.");
    await this.ensureAnotherSuperadmin(id);
    await this.prisma.adminUser.delete({ where: { id } });
    await this.audit.log({ actorAdminId: req.user.sub, actorEmail: req.user.email, action: "admin_user.delete", targetType: "AdminUser", targetId: id });
    return { success: true };
  }

  @Get("overview")
  @ApiOperation({ summary: "Admin dashboard overview", description: "Counts and latest audit entries for the internal admin dashboard." })
  @ApiOkResponse({ description: "Overview counters and recent audit logs.", schema: { example: { singleKeys: 12, enterpriseKeys: 3, activations: 8, activeUniqueDevices: 7, templates: 5, audits: [] } } })
  async overview(@Req() req: any) {
    const partnerId = this.scopedPartnerId(req);
    const singleWhere = partnerId ? { partnerId } : {};
    const enterpriseWhere = partnerId ? { OR: [{ partnerId }, { tenant: { partnerId } }] } : {};
    const activationWhere = partnerId ? { OR: [{ tenant: { partnerId } }, { singleLicenseKey: { partnerId } }] } : {};
    const templateWhere = partnerId ? { entitlements: { some: { tenant: { partnerId } } } } : {};
    const [singleKeys, enterpriseKeys, activations, activeUniqueDevices, templates, audits] = await Promise.all([
      this.prisma.singleLicenseKey.count({ where: singleWhere }),
      this.prisma.enterpriseLicenseKey.count({ where: enterpriseWhere }),
      this.prisma.deviceActivation.count({ where: activationWhere }),
      this.prisma.deviceActivation.findMany({ where: { ...activationWhere, status: "active" }, select: { deviceIdentifier: true } }),
      this.prisma.templateFamily.count({ where: templateWhere }),
      this.prisma.activationAuditLog.findMany({ where: partnerId ? { actorAdminId: req.user.sub } : {}, orderBy: { createdAt: "desc" }, take: 25 })
    ]);
    return { singleKeys, enterpriseKeys, activations, activeUniqueDevices: new Set(activeUniqueDevices.map((item) => item.deviceIdentifier)).size, templates, audits };
  }

  @Get("single-keys")
  @ApiOperation({ summary: "List single-user license keys", description: "Returns single-user key records. Full keys are never returned after creation; only hashed storage and key prefixes are retained." })
  @ApiOkResponse({ description: "Single-user license key list." })
  singleKeys(@Req() req: any) {
    const partnerId = this.scopedPartnerId(req);
    return this.prisma.singleLicenseKey.findMany({ where: partnerId ? { partnerId } : {}, orderBy: { createdAt: "desc" }, include: { partner: true, activations: true } });
  }

  @Post("single-keys")
  @ApiOperation({ summary: "Generate single-user activation key", description: "Creates a display-once activation key. The response includes activationKey once; store/copy it immediately." })
  @ApiBody({ type: SingleKeyDto })
  @ApiOkResponse({ description: "Single-user key generated.", schema: { example: { id: "license-uuid", activationKey: "ULFY-S-ABC123-DEF456-GHI789-JKL012", keyPrefix: "ULFY-S-ABC123", purchaserFullName: "Ola Nordmann", purchaserEmail: "ola@example.com", status: "active" } } })
  async createSingleKey(@Body() dto: SingleKeyDto, @Req() req: any) {
    const partnerId = this.scopedPartnerId(req) ?? dto.partnerId;
    const activationKey = createActivationKey("ULFY-S");
    const key = await this.prisma.singleLicenseKey.create({
      data: {
        keyHash: sha256(activationKey),
        keyPrefix: activationKey.slice(0, 14),
        purchaserFullName: dto.purchaserFullName,
        purchaserEmail: dto.purchaserEmail,
        purchaseDate: dto.purchaseDate ? new Date(dto.purchaseDate) : undefined,
        maintenanceUntil: dto.maintenanceUntil ? new Date(dto.maintenanceUntil) : undefined,
        notes: dto.notes,
        partnerId,
        createdByAdminId: req.user.sub
      }
    });
    await this.audit.log({ actorAdminId: req.user.sub, actorEmail: req.user.email, action: "license.single.generate", targetType: "SingleLicenseKey", targetId: key.id });
    return { ...key, activationKey };
  }

  @Patch("single-keys/:id/revoke")
  @ApiOperation({ summary: "Toggle single-user license revocation", description: "Revokes an active key, or reactivates a revoked key without resetting the device binding." })
  @ApiParam({ name: "id", description: "SingleLicenseKey UUID." })
  @ApiOkResponse({ description: "License key revocation toggled." })
  async revokeSingle(@Param("id") id: string, @Req() req: any) {
    const current = await this.assertSingleKeyAccess(req, id);
    const status = current.status === "revoked" ? "active" : "revoked";
    const key = await this.prisma.singleLicenseKey.update({ where: { id }, data: { status } });
    await this.prisma.deviceActivation.updateMany({ where: { singleLicenseKeyId: id }, data: { status } });
    await this.audit.log({ actorAdminId: req.user.sub, actorEmail: req.user.email, action: status === "revoked" ? "license.single.revoke" : "license.single.reactivate", targetType: "SingleLicenseKey", targetId: id });
    return key;
  }

  @Patch("single-keys/:id/reset")
  @ApiOperation({ summary: "Reset single-user device binding", description: "Deletes device activations for the single-user key and makes it active/unbound again." })
  @ApiParam({ name: "id", description: "SingleLicenseKey UUID." })
  @ApiOkResponse({ description: "License key reset." })
  async resetSingle(@Param("id") id: string, @Req() req: any) {
    await this.assertSingleKeyAccess(req, id);
    await this.prisma.deviceActivation.deleteMany({ where: { singleLicenseKeyId: id } });
    const key = await this.prisma.singleLicenseKey.update({ where: { id }, data: { deviceIdentifier: null, deviceSerialNumber: null, activatedAt: null, lastCheckIn: null, lastSeenAt: null, status: "active" } });
    await this.audit.log({ actorAdminId: req.user.sub, actorEmail: req.user.email, action: "license.single.reset", targetType: "SingleLicenseKey", targetId: id });
    return key;
  }

  @Delete("single-keys/:id")
  @ApiOperation({ summary: "Delete single-user license key", description: "Deletes a single-user key and any associated device activations." })
  @ApiParam({ name: "id", description: "SingleLicenseKey UUID." })
  @ApiOkResponse({ description: "Single-user key deleted.", schema: { example: { success: true, deletedActivations: 1 } } })
  async deleteSingleKey(@Param("id") id: string, @Req() req: any) {
    await this.assertSingleKeyAccess(req, id);
    const deletedActivations = await this.prisma.deviceActivation.deleteMany({ where: { singleLicenseKeyId: id } });
    await this.prisma.singleLicenseKey.delete({ where: { id } });
    await this.audit.log({
      actorAdminId: req.user.sub,
      actorEmail: req.user.email,
      action: "license.single.delete",
      targetType: "SingleLicenseKey",
      targetId: id,
      metadata: { deletedActivations: deletedActivations.count }
    });
    return { success: true, deletedActivations: deletedActivations.count };
  }

  @Get("enterprise-keys")
  @ApiOperation({ summary: "List enterprise license keys" })
  @ApiOkResponse({ description: "Enterprise license key list with tenant/config profile info." })
  enterpriseKeys(@Req() req: any) {
    const partnerId = this.scopedPartnerId(req);
    return this.prisma.enterpriseLicenseKey.findMany({
      where: partnerId ? { OR: [{ partnerId }, { tenant: { partnerId } }] } : {},
      orderBy: { createdAt: "desc" },
      include: { tenant: true, partner: true, configProfile: true, activations: true }
    });
  }

  @Post("enterprise-keys")
  @ApiOperation({ summary: "Generate enterprise activation key", description: "Creates a display-once enterprise activation key linked to a tenant and config profile." })
  @ApiBody({ type: EnterpriseKeyDto })
  @ApiOkResponse({ description: "Enterprise key generated.", schema: { example: { id: "enterprise-key-uuid", activationKey: "ULFY-E-ABC123-DEF456-GHI789-JKL012", keyPrefix: "ULFY-E-ABC123", status: "active", maxDevices: 100 } } })
  async createEnterpriseKey(@Body() dto: EnterpriseKeyDto, @Req() req: any) {
    const tenant = await this.assertTenantAccess(req, dto.tenantId);
    await this.assertConfigAccess(req, dto.configProfileId);
    const activationKey = createActivationKey("ULFY-E");
    const key = await this.prisma.enterpriseLicenseKey.create({
      data: {
        keyHash: sha256(activationKey),
        keyPrefix: activationKey.slice(0, 14),
        tenantId: dto.tenantId,
        configProfileId: dto.configProfileId,
        maxDevices: dto.maxDevices,
        maintenanceUntil: dto.maintenanceUntil ? new Date(dto.maintenanceUntil) : undefined,
        notes: dto.notes,
        partnerId: tenant.partnerId,
        createdByAdminId: req.user.sub
      },
      include: { tenant: true, configProfile: true }
    });
    await this.audit.log({ actorAdminId: req.user.sub, actorEmail: req.user.email, action: "license.enterprise.generate", targetType: "EnterpriseLicenseKey", targetId: key.id });
    return { ...key, activationKey };
  }

  @Delete("enterprise-keys/:id")
  @ApiOperation({ summary: "Delete enterprise license key", description: "Deletes an enterprise key and any registered device activations for that key." })
  @ApiParam({ name: "id", description: "EnterpriseLicenseKey UUID." })
  @ApiOkResponse({ description: "Enterprise key deleted.", schema: { example: { success: true, deletedActivations: 3 } } })
  async deleteEnterpriseKey(@Param("id") id: string, @Req() req: any) {
    await this.assertEnterpriseKeyAccess(req, id);
    const deletedActivations = await this.prisma.deviceActivation.deleteMany({ where: { enterpriseLicenseKeyId: id } });
    await this.prisma.enterpriseLicenseKey.delete({ where: { id } });
    await this.audit.log({
      actorAdminId: req.user.sub,
      actorEmail: req.user.email,
      action: "license.enterprise.delete",
      targetType: "EnterpriseLicenseKey",
      targetId: id,
      metadata: { deletedActivations: deletedActivations.count }
    });
    return { success: true, deletedActivations: deletedActivations.count };
  }

  @Get("tenants")
  @ApiOperation({ summary: "List tenants", description: "Returns enterprise/customer tenant records with active unique-device license usage counts." })
  @ApiOkResponse({ description: "Tenant list with license usage.", schema: { example: [{ id: "tenant-uuid", name: "Acme Health", slug: "acme-health", contactEmail: "kari@acme.example", licenseUsage: { activeDevices: 8, totalDevices: 10, enterpriseKeys: 2, licensedDevices: 100, unlimited: false } }] } })
  async tenants(@Req() req: any) {
    const partnerId = this.scopedPartnerId(req);
    const tenants = await this.prisma.tenant.findMany({
      where: partnerId ? { partnerId } : {},
      orderBy: { name: "asc" },
      include: { configProfile: true, partner: true, activations: true, enterpriseKeys: true }
    });
    return tenants.map((tenant) => ({ ...tenant, licenseUsage: this.tenantLicenseUsage(tenant) }));
  }

  @Post("tenants")
  @ApiOperation({ summary: "Create tenant/customer", description: "Registers an enterprise customer/tenant and optional contact/legal/billing details." })
  @ApiBody({ type: TenantDto })
  @ApiOkResponse({ description: "Tenant created." })
  async tenantsCreate(@Body() dto: TenantDto, @Req() req: any) {
    const partnerId = this.scopedPartnerId(req);
    if (partnerId) dto.partnerId = partnerId;
    if (dto.configProfileId) await this.assertConfigAccess(req, dto.configProfileId);
    const tenant = await this.prisma.tenant.create({ data: this.cleanTenant(dto) as any });
    await this.audit.log({ actorAdminId: req.user.sub, actorEmail: req.user.email, action: "tenant.create", targetType: "Tenant", targetId: tenant.id });
    return tenant;
  }

  @Patch("tenants/:id")
  @ApiOperation({ summary: "Update tenant/customer details" })
  @ApiParam({ name: "id", description: "Tenant UUID." })
  @ApiBody({ type: TenantDto })
  @ApiOkResponse({ description: "Tenant updated." })
  async tenantsUpdate(@Param("id") id: string, @Body() dto: Partial<TenantDto>, @Req() req: any) {
    await this.assertTenantAccess(req, id);
    const partnerId = this.scopedPartnerId(req);
    if (partnerId) dto.partnerId = partnerId;
    if (dto.configProfileId) await this.assertConfigAccess(req, dto.configProfileId);
    const tenant = await this.prisma.tenant.update({ where: { id }, data: this.cleanTenant(dto) as any });
    await this.audit.log({ actorAdminId: req.user.sub, actorEmail: req.user.email, action: "tenant.update", targetType: "Tenant", targetId: id });
    return tenant;
  }

  @Delete("tenants/:id")
  @ApiOperation({ summary: "Delete tenant/customer", description: "Deletes a tenant only when it has no enterprise keys, activations, or tenant-specific templates." })
  @ApiParam({ name: "id", description: "Tenant UUID." })
  @ApiOkResponse({ description: "Tenant deleted.", schema: { example: { success: true } } })
  @ApiConflictResponse({ description: "Tenant is in use and cannot be deleted." })
  async tenantsDelete(@Param("id") id: string, @Req() req: any) {
    await this.assertTenantAccess(req, id);
    const [enterpriseKeys, activations, templates, entitlements] = await Promise.all([
      this.prisma.enterpriseLicenseKey.count({ where: { tenantId: id } }),
      this.prisma.deviceActivation.count({ where: { tenantId: id } }),
      this.prisma.template.count({ where: { tenantId: id } }),
      this.prisma.tenantTemplateEntitlement.count({ where: { tenantId: id } })
    ]);
    if (enterpriseKeys || activations || templates || entitlements) {
      throw new ConflictException("Cannot delete tenant with enterprise keys, activations, or template entitlements. Disable it instead.");
    }
    await this.prisma.tenant.delete({ where: { id } });
    await this.audit.log({ actorAdminId: req.user.sub, actorEmail: req.user.email, action: "tenant.delete", targetType: "Tenant", targetId: id });
    return { success: true };
  }

  @Get("license-usage")
  @ApiOperation({ summary: "Enterprise license usage summary", description: "Shows unique active device counts per tenant and global active unique-device totals." })
  @ApiOkResponse({ description: "License usage summary.", schema: { example: { activeUniqueDevices: 8, tenants: [{ tenantId: "tenant-uuid", name: "Acme Health", activeDevices: 8, totalDevices: 10, licensedDevices: 100, unlimited: false }] } } })
  async licenseUsage(@Req() req: any) {
    const partnerId = this.scopedPartnerId(req);
    const tenants = await this.prisma.tenant.findMany({ where: partnerId ? { partnerId } : {}, orderBy: { name: "asc" }, include: { activations: true, enterpriseKeys: true } });
    const activeDeviceSet = new Set<string>();
    const tenantUsage = tenants.map((tenant) => {
      const usage = this.tenantLicenseUsage(tenant);
      tenant.activations.filter((activation) => activation.status === "active").forEach((activation) => activeDeviceSet.add(activation.deviceIdentifier));
      return { tenantId: tenant.id, name: tenant.name, slug: tenant.slug, ...usage };
    });
    return { activeUniqueDevices: activeDeviceSet.size, tenants: tenantUsage };
  }

  @Get("config-profiles")
  @ApiOperation({ summary: "List config profiles" })
  @ApiOkResponse({ description: "Config profile list." })
  configProfiles(@Req() req: any) {
    const partnerId = this.scopedPartnerId(req);
    return this.prisma.configProfile.findMany({ where: partnerId ? { partnerId } : {}, orderBy: { updatedAt: "desc" }, include: { partner: true } });
  }

  @Post("config-profiles")
  @ApiOperation({ summary: "Create config profile", description: "Creates a manually managed enterprise configuration profile." })
  @ApiBody({ type: ConfigDto })
  @ApiOkResponse({ description: "Config profile created." })
  async createConfig(@Body() dto: ConfigDto, @Req() req: any) {
    const partnerId = this.scopedPartnerId(req);
    if (partnerId) dto.partnerId = partnerId;
    const profile = await this.prisma.configProfile.create({ data: this.cleanConfig(dto) as any });
    await this.audit.log({ actorAdminId: req.user.sub, actorEmail: req.user.email, action: "config.create", targetType: "ConfigProfile", targetId: profile.id });
    return profile;
  }

  @Post("config-profiles/:id/clone")
  @ApiOperation({ summary: "Clone config profile", description: "Creates a new policy/config profile by copying all managed provider, privacy, repository, and policy fields from an existing profile." })
  @ApiParam({ name: "id", description: "ConfigProfile UUID to clone." })
  @ApiBody({ type: CloneConfigDto, required: false })
  @ApiOkResponse({ description: "Config profile cloned." })
  async cloneConfig(@Param("id") id: string, @Body() dto: CloneConfigDto = {}, @Req() req: any) {
    const source = await this.assertConfigAccess(req, id);
    const {
      id: _id,
      createdAt: _createdAt,
      updatedAt: _updatedAt,
      tenants: _tenants,
      enterpriseKeys: _enterpriseKeys,
      partner: _partner,
      ...copyable
    } = source as any;
    const name = this.emptyToNull(dto?.name) ?? `Copy of ${source.name}`;
    const profile = await this.prisma.configProfile.create({
      data: {
        ...copyable,
        name
      },
      include: { partner: true }
    });
    await this.audit.log({
      actorAdminId: req.user.sub,
      actorEmail: req.user.email,
      action: "config.clone",
      targetType: "ConfigProfile",
      targetId: profile.id,
      metadata: { sourceConfigProfileId: id }
    });
    return profile;
  }

  @Patch("config-profiles/:id")
  @ApiOperation({ summary: "Update config profile" })
  @ApiParam({ name: "id", description: "ConfigProfile UUID." })
  @ApiBody({ type: ConfigDto })
  @ApiOkResponse({ description: "Config profile updated." })
  async updateConfig(@Param("id") id: string, @Body() dto: ConfigDto, @Req() req: any) {
    await this.assertConfigAccess(req, id);
    const partnerId = this.scopedPartnerId(req);
    if (partnerId) dto.partnerId = partnerId;
    const profile = await this.prisma.configProfile.update({ where: { id }, data: this.cleanConfig(dto) as any });
    await this.audit.log({ actorAdminId: req.user.sub, actorEmail: req.user.email, action: "config.update", targetType: "ConfigProfile", targetId: id });
    return profile;
  }

  @Delete("config-profiles/:id")
  @ApiOperation({ summary: "Delete config profile", description: "Deletes a config profile only when no tenants or enterprise keys reference it." })
  @ApiParam({ name: "id", description: "ConfigProfile UUID." })
  @ApiOkResponse({ description: "Config profile deleted.", schema: { example: { success: true } } })
  @ApiConflictResponse({ description: "Config profile is in use and cannot be deleted." })
  async deleteConfig(@Param("id") id: string, @Req() req: any) {
    await this.assertConfigAccess(req, id);
    const [tenants, enterpriseKeys] = await Promise.all([
      this.prisma.tenant.count({ where: { configProfileId: id } }),
      this.prisma.enterpriseLicenseKey.count({ where: { configProfileId: id } })
    ]);
    if (tenants || enterpriseKeys) {
      throw new ConflictException("Cannot delete config profile while tenants or enterprise keys reference it.");
    }
    await this.prisma.configProfile.delete({ where: { id } });
    await this.audit.log({ actorAdminId: req.user.sub, actorEmail: req.user.email, action: "config.delete", targetType: "ConfigProfile", targetId: id });
    return { success: true };
  }

  @Get("template-families")
  @ApiOperation({ summary: "Template repository families", description: "Lists template families with language variants, mutable drafts, published version history and tenant entitlements." })
  @ApiOkResponse({ description: "Template repository family list." })
  templateFamilies(@Req() req: any) {
    const partnerId = this.scopedPartnerId(req);
    return this.prisma.templateFamily.findMany({
      where: partnerId ? { OR: [{ isGlobal: true }, { entitlements: { some: { tenant: { partnerId } } } }] } : {},
      orderBy: { updatedAt: "desc" },
      include: this.templateFamilyInclude()
    });
  }

  @Post("template-families")
  @ApiOperation({ summary: "Create template family", description: "Creates the logical use-case family that groups language-specific template variants." })
  @ApiBody({ type: TemplateFamilyDto })
  @ApiOkResponse({ description: "Template family created." })
  async createTemplateFamily(@Body() dto: TemplateFamilyDto, @Req() req: any) {
    const family = await this.prisma.templateFamily.create({
      data: {
        title: dto.title,
        shortDescription: dto.shortDescription,
        categoryId: dto.categoryId || undefined,
        icon: dto.icon || "doc.text",
        tags: dto.tags ?? [],
        isGlobal: dto.isGlobal ?? false
      },
      include: this.templateFamilyInclude()
    });
    await this.audit.log({ actorAdminId: req.user.sub, actorEmail: req.user.email, action: "template.family.create", targetType: "TemplateFamily", targetId: family.id });
    return family;
  }

  @Patch("template-families/:id")
  @ApiOperation({ summary: "Update template family metadata" })
  @ApiParam({ name: "id", description: "TemplateFamily UUID." })
  @ApiBody({ type: TemplateFamilyDto })
  @ApiOkResponse({ description: "Template family updated." })
  async updateTemplateFamily(@Param("id") id: string, @Body() dto: Partial<TemplateFamilyDto>, @Req() req: any) {
    await this.assertTemplateFamilyAccess(req, id);
    const family = await this.prisma.templateFamily.update({
      where: { id },
      data: {
        title: dto.title,
        shortDescription: dto.shortDescription,
        categoryId: dto.categoryId || undefined,
        icon: dto.icon,
        tags: dto.tags as any,
        isGlobal: dto.isGlobal
      },
      include: this.templateFamilyInclude()
    });
    await this.audit.log({ actorAdminId: req.user.sub, actorEmail: req.user.email, action: "template.family.update", targetType: "TemplateFamily", targetId: id });
    return family;
  }

  @Patch("template-families/:id/archive")
  @ApiOperation({ summary: "Archive template family", description: "Archived families are hidden from the mobile manifest." })
  @ApiParam({ name: "id", description: "TemplateFamily UUID." })
  @ApiOkResponse({ description: "Template family archived." })
  async archiveTemplateFamily(@Param("id") id: string, @Req() req: any) {
    await this.assertTemplateFamilyAccess(req, id);
    const family = await this.prisma.templateFamily.update({ where: { id }, data: { state: "archived" }, include: this.templateFamilyInclude() });
    await this.audit.log({ actorAdminId: req.user.sub, actorEmail: req.user.email, action: "template.family.archive", targetType: "TemplateFamily", targetId: id });
    return family;
  }

  @Post("template-families/:id/variants")
  @ApiOperation({ summary: "Create language variant draft", description: "Creates one language-specific YAML track inside a template family." })
  @ApiParam({ name: "id", description: "TemplateFamily UUID." })
  @ApiBody({ type: TemplateVariantDto })
  @ApiOkResponse({ description: "Template variant created." })
  async createTemplateVariant(@Param("id") id: string, @Body() dto: TemplateVariantDto, @Req() req: any) {
    await this.assertTemplateFamilyAccess(req, id);
    const metadata = this.templates.metadataFromYaml(dto.yamlContent);
    if (metadata.language !== dto.language) throw new ConflictException("Variant language must match identity.language in the YAML.");
    const variant = await this.prisma.templateVariant.create({
      data: {
        familyId: id,
        language: metadata.language,
        templateIdentityId: metadata.id,
        draft: { create: { yamlContent: dto.yamlContent, sampleTranscript: dto.sampleTranscript, createdByAdminId: req.user.sub } }
      },
      include: { family: true, draft: true, publishedVersions: { orderBy: { publishedAt: "desc" } } }
    });
    await this.prisma.templateFamily.update({
      where: { id },
      data: { title: metadata.title, shortDescription: metadata.shortDescription, icon: metadata.icon, tags: metadata.tags }
    });
    await this.audit.log({ actorAdminId: req.user.sub, actorEmail: req.user.email, action: "template.variant.create", targetType: "TemplateVariant", targetId: variant.id });
    return variant;
  }

  @Patch("template-variants/:id/draft")
  @ApiOperation({ summary: "Update template variant draft", description: "Updates the mutable draft YAML and sample transcript. This does not affect the mobile app until published." })
  @ApiParam({ name: "id", description: "TemplateVariant UUID." })
  @ApiBody({ type: TemplateDraftDto })
  @ApiOkResponse({ description: "Template draft updated." })
  async updateTemplateDraft(@Param("id") id: string, @Body() dto: TemplateDraftDto, @Req() req: any) {
    const variant = await this.assertTemplateVariantAccess(req, id);
    const metadata = this.templates.metadataFromYaml(dto.yamlContent);
    const draft = await this.prisma.templateDraft.upsert({
      where: { variantId: id },
      update: {
        yamlContent: dto.yamlContent,
        sampleTranscript: dto.sampleTranscript,
        previewError: null
      },
      create: {
        variantId: id,
        yamlContent: dto.yamlContent,
        sampleTranscript: dto.sampleTranscript,
        createdByAdminId: req.user.sub
      }
    });
    await this.prisma.templateVariant.update({ where: { id }, data: { language: metadata.language, templateIdentityId: metadata.id } });
    await this.prisma.templateFamily.update({ where: { id: variant.familyId }, data: { title: metadata.title, shortDescription: metadata.shortDescription, icon: metadata.icon, tags: metadata.tags } });
    await this.audit.log({ actorAdminId: req.user.sub, actorEmail: req.user.email, action: "template.draft.update", targetType: "TemplateDraft", targetId: draft.id });
    return draft;
  }

  @Post("template-variants/:id/publish")
  @ApiOperation({ summary: "Publish template variant draft", description: "Validates the current draft, applies the selected semver bump, and stores an immutable published YAML snapshot." })
  @ApiParam({ name: "id", description: "TemplateVariant UUID." })
  @ApiBody({ type: TemplatePublishDto })
  @ApiOkResponse({ description: "Template variant published.", schema: { example: { success: true, version: "1.0.1" } } })
  async publishTemplateVariant(@Param("id") id: string, @Body() dto: TemplatePublishDto, @Req() req: any) {
    await this.assertTemplateVariantAccess(req, id);
    return this.templates.publishVariantDraft(id, dto, { id: req.user.sub, email: req.user.email });
  }

  @Get("template-variants/:id/versions")
  @ApiOperation({ summary: "Published version history for a template variant" })
  @ApiParam({ name: "id", description: "TemplateVariant UUID." })
  @ApiOkResponse({ description: "Published template versions." })
  async templateVariantVersions(@Param("id") id: string, @Req() req: any) {
    await this.assertTemplateVariantAccess(req, id);
    return this.prisma.publishedTemplateVersion.findMany({ where: { variantId: id }, orderBy: { publishedAt: "desc" } });
  }

  @Post("template-families/:id/entitlements")
  @ApiOperation({ summary: "Assign template family to tenant" })
  @ApiParam({ name: "id", description: "TemplateFamily UUID." })
  @ApiBody({ type: TemplateEntitlementDto })
  @ApiOkResponse({ description: "Tenant entitlement assigned." })
  async addTemplateEntitlement(@Param("id") id: string, @Body() dto: TemplateEntitlementDto, @Req() req: any) {
    await this.assertTemplateFamilyAccess(req, id);
    await this.assertTenantAccess(req, dto.tenantId);
    const entitlement = await this.prisma.tenantTemplateEntitlement.upsert({
      where: { tenantId_familyId: { tenantId: dto.tenantId, familyId: id } },
      update: {},
      create: { tenantId: dto.tenantId, familyId: id, createdByAdminId: req.user.sub },
      include: { tenant: true, family: true }
    });
    await this.audit.log({ actorAdminId: req.user.sub, actorEmail: req.user.email, action: "template.entitlement.assign", targetType: "TemplateFamily", targetId: id, metadata: { tenantId: dto.tenantId } });
    return entitlement;
  }

  @Delete("template-families/:familyId/entitlements/:tenantId")
  @ApiOperation({ summary: "Remove template family tenant assignment" })
  @ApiParam({ name: "familyId", description: "TemplateFamily UUID." })
  @ApiParam({ name: "tenantId", description: "Tenant UUID." })
  @ApiOkResponse({ description: "Tenant entitlement removed.", schema: { example: { success: true } } })
  async removeTemplateEntitlement(@Param("familyId") familyId: string, @Param("tenantId") tenantId: string, @Req() req: any) {
    await this.assertTemplateFamilyAccess(req, familyId);
    await this.assertTenantAccess(req, tenantId);
    await this.prisma.tenantTemplateEntitlement.deleteMany({ where: { familyId, tenantId } });
    await this.audit.log({ actorAdminId: req.user.sub, actorEmail: req.user.email, action: "template.entitlement.remove", targetType: "TemplateFamily", targetId: familyId, metadata: { tenantId } });
    return { success: true };
  }

  @Post("template-drafts/ai-assist")
  @ApiOperation({ summary: "Generate AI-assisted draft proposal", description: "Creates a reviewable YAML draft proposal from a use-case description. The proposal is never auto-published." })
  @ApiBody({ type: TemplateAiAssistDto })
  @ApiOkResponse({ description: "Draft proposal generated." })
  aiAssistTemplateDraft(@Body() dto: TemplateAiAssistDto) {
    return this.templates.buildAssistedDraft(dto);
  }

  @Post("template-drafts/:id/preview")
  @ApiOperation({ summary: "Generate real AI preview for a draft", description: "Runs the centrally configured preview provider/model against the current draft and sample transcript. This is manual and never runs on every edit." })
  @ApiParam({ name: "id", description: "TemplateDraft UUID." })
  @ApiOkResponse({ description: "Generated preview metadata and markdown." })
  async generateTemplatePreview(@Param("id") id: string, @Req() req: any) {
    await this.assertTemplateDraftAccess(req, id);
    return this.templates.generatePreview(id, { id: req.user.sub, email: req.user.email });
  }

  @Get("template-drafts/:id/preview")
  @ApiOperation({ summary: "Get latest stored draft preview" })
  @ApiParam({ name: "id", description: "TemplateDraft UUID." })
  @ApiOkResponse({ description: "Latest preview metadata and markdown." })
  async getTemplatePreview(@Param("id") id: string, @Req() req: any) {
    const draft = await this.assertTemplateDraftAccess(req, id);
    return this.templates.mapPreview(draft);
  }

  @Get("templates")
  @ApiOperation({ summary: "Admin template list", description: "Lists templates with category and version history for the admin UI." })
  @ApiOkResponse({ description: "Template list." })
  templatesList(@Req() req: any) {
    const partnerId = this.scopedPartnerId(req);
    return this.prisma.template.findMany({
      where: partnerId ? { OR: [{ tenantId: null }, { tenant: { partnerId } }] } : {},
      orderBy: { updatedAt: "desc" },
      include: { category: true, tenant: true, versions: { orderBy: { createdAt: "desc" } } }
    });
  }

  @Get("template-categories")
  @ApiOperation({ summary: "List template categories" })
  @ApiOkResponse({ description: "Template categories." })
  categories() {
    return this.prisma.templateCategory.findMany({ orderBy: { title: "asc" } });
  }

  @Post("template-categories")
  @ApiOperation({ summary: "Create template category", description: "Superadmin only. Categories are used by template families and YAML identity metadata." })
  @ApiBody({ type: TemplateCategoryDto })
  @ApiOkResponse({ description: "Template category created." })
  async createTemplateCategory(@Body() dto: TemplateCategoryDto, @Req() req: any) {
    this.requireSuperadmin(req);
    const category = await this.prisma.templateCategory.create({
      data: { slug: this.normalizeSlug(dto.slug), title: dto.title, description: dto.description }
    });
    await this.audit.log({ actorAdminId: req.user.sub, actorEmail: req.user.email, action: "template.category.create", targetType: "TemplateCategory", targetId: category.id });
    return category;
  }

  @Patch("template-categories/:id")
  @ApiOperation({ summary: "Update template category", description: "Superadmin only." })
  @ApiParam({ name: "id", description: "TemplateCategory UUID." })
  @ApiBody({ type: TemplateCategoryDto })
  @ApiOkResponse({ description: "Template category updated." })
  async updateTemplateCategory(@Param("id") id: string, @Body() dto: Partial<TemplateCategoryDto>, @Req() req: any) {
    this.requireSuperadmin(req);
    const category = await this.prisma.templateCategory.update({
      where: { id },
      data: {
        slug: dto.slug ? this.normalizeSlug(dto.slug) : undefined,
        title: dto.title,
        description: dto.description
      }
    });
    await this.audit.log({ actorAdminId: req.user.sub, actorEmail: req.user.email, action: "template.category.update", targetType: "TemplateCategory", targetId: id });
    return category;
  }

  @Delete("template-categories/:id")
  @ApiOperation({ summary: "Delete template category", description: "Superadmin only. Categories in use by templates or families cannot be deleted." })
  @ApiParam({ name: "id", description: "TemplateCategory UUID." })
  @ApiOkResponse({ description: "Template category deleted.", schema: { example: { success: true } } })
  async deleteTemplateCategory(@Param("id") id: string, @Req() req: any) {
    this.requireSuperadmin(req);
    const [templates, families] = await Promise.all([
      this.prisma.template.count({ where: { categoryId: id } }),
      this.prisma.templateFamily.count({ where: { categoryId: id } })
    ]);
    if (templates || families) throw new ConflictException("Cannot delete a category while templates or template families use it.");
    await this.prisma.templateCategory.delete({ where: { id } });
    await this.audit.log({ actorAdminId: req.user.sub, actorEmail: req.user.email, action: "template.category.delete", targetType: "TemplateCategory", targetId: id });
    return { success: true };
  }

  @Get("template-section-presets")
  @ApiOperation({ summary: "List template section presets", description: "Reusable section building blocks shown in the admin template designer." })
  @ApiOkResponse({ description: "Template section presets." })
  templateSectionPresets() {
    return this.prisma.templateSectionPreset.findMany({ orderBy: [{ sortOrder: "asc" }, { title: "asc" }] });
  }

  @Post("template-section-presets")
  @ApiOperation({ summary: "Create template section preset", description: "Superadmin only." })
  @ApiBody({ type: TemplateSectionPresetDto })
  @ApiOkResponse({ description: "Template section preset created." })
  async createTemplateSectionPreset(@Body() dto: TemplateSectionPresetDto, @Req() req: any) {
    this.requireSuperadmin(req);
    const preset = await this.prisma.templateSectionPreset.create({ data: this.cleanTemplateSectionPresetCreate(dto) });
    await this.audit.log({ actorAdminId: req.user.sub, actorEmail: req.user.email, action: "template.section_preset.create", targetType: "TemplateSectionPreset", targetId: preset.id });
    return preset;
  }

  @Patch("template-section-presets/:id")
  @ApiOperation({ summary: "Update template section preset", description: "Superadmin only." })
  @ApiParam({ name: "id", description: "TemplateSectionPreset UUID." })
  @ApiBody({ type: TemplateSectionPresetDto })
  @ApiOkResponse({ description: "Template section preset updated." })
  async updateTemplateSectionPreset(@Param("id") id: string, @Body() dto: Partial<TemplateSectionPresetDto>, @Req() req: any) {
    this.requireSuperadmin(req);
    const preset = await this.prisma.templateSectionPreset.update({ where: { id }, data: this.cleanTemplateSectionPresetUpdate(dto) });
    await this.audit.log({ actorAdminId: req.user.sub, actorEmail: req.user.email, action: "template.section_preset.update", targetType: "TemplateSectionPreset", targetId: id });
    return preset;
  }

  @Delete("template-section-presets/:id")
  @ApiOperation({ summary: "Delete template section preset", description: "Superadmin only. Existing template YAML is not changed." })
  @ApiParam({ name: "id", description: "TemplateSectionPreset UUID." })
  @ApiOkResponse({ description: "Template section preset deleted.", schema: { example: { success: true } } })
  async deleteTemplateSectionPreset(@Param("id") id: string, @Req() req: any) {
    this.requireSuperadmin(req);
    await this.prisma.templateSectionPreset.delete({ where: { id } });
    await this.audit.log({ actorAdminId: req.user.sub, actorEmail: req.user.email, action: "template.section_preset.delete", targetType: "TemplateSectionPreset", targetId: id });
    return { success: true };
  }

  @Get("template-tags")
  @ApiOperation({ summary: "List known template tags", description: "Aggregates tags used by legacy templates and repository template families." })
  @ApiOkResponse({ description: "Known template tags.", schema: { example: ["dictation", "personal", "meeting"] } })
  async templateTags() {
    const [families, templates] = await Promise.all([
      this.prisma.templateFamily.findMany({ select: { tags: true } }),
      this.prisma.template.findMany({ select: { tags: true } })
    ]);
    const tags = new Set<string>();
    for (const row of [...families, ...templates]) {
      if (Array.isArray(row.tags)) {
        for (const tag of row.tags) {
          if (typeof tag === "string" && tag.trim()) tags.add(tag.trim());
        }
      }
    }
    return [...tags].sort((a, b) => a.localeCompare(b));
  }

  @Post("templates")
  @ApiOperation({ summary: "Create template draft/version", description: "Creates a template and initial YAML version after YAML/schema validation." })
  @ApiBody({ type: TemplateDto })
  @ApiOkResponse({ description: "Template created." })
  async createTemplate(@Body() dto: TemplateDto, @Req() req: any) {
    if (this.scopedPartnerId(req)) {
      if (!dto.tenantId) throw new ForbiddenException("Partner admins can only create tenant-specific templates.");
      await this.assertTenantAccess(req, dto.tenantId);
    }
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
    await this.assertTemplateAccess(req, id);
    if (dto.tenantId) await this.assertTenantAccess(req, dto.tenantId);
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
  async publish(@Param("id") id: string, @Param("versionId") versionId: string, @Req() req: any) {
    await this.assertTemplateAccess(req, id);
    return this.templates.publish(id, versionId, { id: req.user.sub, email: req.user.email });
  }

  @Patch("templates/:id/archive")
  @ApiOperation({ summary: "Archive template" })
  @ApiParam({ name: "id", description: "Template UUID." })
  @ApiOkResponse({ description: "Template archived." })
  async archive(@Param("id") id: string, @Req() req: any) {
    await this.assertTemplateAccess(req, id);
    this.audit.log({ actorAdminId: req.user.sub, actorEmail: req.user.email, action: "template.archive", targetType: "Template", targetId: id });
    return this.prisma.template.update({ where: { id }, data: { state: "archived" } });
  }

  @Get("activations")
  @ApiOperation({ summary: "List device activations" })
  @ApiOkResponse({ description: "Device activation list." })
  activations(@Req() req: any) {
    const partnerId = this.scopedPartnerId(req);
    return this.prisma.deviceActivation.findMany({
      where: partnerId ? { OR: [{ tenant: { partnerId } }, { singleLicenseKey: { partnerId } }] } : {},
      orderBy: { lastSeenAt: "desc" },
      include: { singleLicenseKey: true, enterpriseLicenseKey: { include: { tenant: true } } }
    });
  }

  @Delete("activations/:id")
  @ApiOperation({ summary: "Delete enterprise device activation", description: "Removes one enterprise device activation to free a licensed device slot. Single-user activations must be reset from the license key." })
  @ApiParam({ name: "id", description: "DeviceActivation UUID." })
  @ApiOkResponse({ description: "Enterprise device activation deleted.", schema: { example: { success: true } } })
  @ApiConflictResponse({ description: "Single-user activations cannot be deleted directly." })
  async deleteActivation(@Param("id") id: string, @Req() req: any) {
    const activation = await this.findScopedActivation(req, id);
    if (activation.kind !== "enterprise" || !activation.enterpriseLicenseKeyId) {
      throw new ConflictException("Only enterprise device activations can be deleted directly. Reset single-user licenses instead.");
    }
    await this.prisma.deviceActivation.delete({ where: { id } });
    await this.audit.log({
      actorAdminId: req.user.sub,
      actorEmail: req.user.email,
      action: "activation.enterprise.delete",
      targetType: "DeviceActivation",
      targetId: id,
      metadata: { enterpriseLicenseKeyId: activation.enterpriseLicenseKeyId, tenantId: activation.tenantId, deviceIdentifier: activation.deviceIdentifier }
    });
    return { success: true };
  }

  @Get("audit-logs")
  @ApiOperation({ summary: "List audit logs", description: "Returns latest activation/config/license/template audit entries." })
  @ApiOkResponse({ description: "Audit log list." })
  auditLogs(@Req() req: any) {
    const partnerId = this.scopedPartnerId(req);
    return this.prisma.activationAuditLog.findMany({ where: partnerId ? { actorAdminId: req.user.sub } : {}, orderBy: { createdAt: "desc" }, take: 200 });
  }

  private cleanConfig(dto: ConfigDto) {
    const data: Record<string, unknown> = {
      name: dto.name,
      partnerId: this.emptyToNull(dto.partnerId),
      description: this.emptyToNull(dto.description as string | undefined),
      speechProviderType: this.emptyToNull(dto.speechProviderType),
      speechEndpointUrl: this.emptyToNull(dto.speechEndpointUrl),
      speechModelName: this.emptyToNull(dto.speechModelName),
      speechApiKey: this.emptyToNull(dto.speechApiKey),
      privacyControlEnabled: dto.privacyControlEnabled ?? false,
      piiControlEnabled: dto.piiControlEnabled ?? false,
      presidioEndpointUrl: this.emptyToNull(dto.presidioEndpointUrl),
      presidioSecretRef: this.emptyToNull(dto.presidioSecretRef),
      privacyReviewProviderType: this.emptyToNull(dto.privacyReviewProviderType),
      privacyReviewEndpointUrl: this.emptyToNull(dto.privacyReviewEndpointUrl),
      privacyReviewModel: this.emptyToNull(dto.privacyReviewModel),
      documentGenerationProviderType: this.emptyToNull(dto.documentGenerationProviderType),
      documentGenerationEndpointUrl: this.emptyToNull(dto.documentGenerationEndpointUrl),
      documentGenerationModel: this.emptyToNull(dto.documentGenerationModel),
      documentGenerationApiKey: this.emptyToNull(dto.documentGenerationApiKey),
      templateRepositoryUrl: this.emptyToNull(dto.templateRepositoryUrl),
      telemetryEndpointUrl: this.emptyToNull(dto.telemetryEndpointUrl),
      featureFlags: dto.featureFlags ?? {},
      allowedProviderRestrictions: dto.allowedProviderRestrictions ?? [],
      providerProfiles: dto.providerProfiles ?? {},
      managedPolicy: dto.managedPolicy ?? {},
      defaultTemplateId: this.emptyToNull(dto.defaultTemplateId ?? undefined)
    };
    return data;
  }

  private emptyToNull(value?: string | null) {
    if (value === undefined) return undefined;
    if (value === null) return null;
    const trimmed = value.trim();
    return trimmed ? trimmed : null;
  }

  private cleanPartner(dto: Partial<PartnerDto>) {
    return {
      name: dto.name,
      email: dto.email,
      notes: dto.notes
    };
  }

  private normalizeSlug(value: string) {
    const slug = value.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
    if (!slug) throw new ConflictException("Slug must contain at least one letter or number.");
    return slug;
  }

  private cleanTemplateSectionPresetCreate(dto: TemplateSectionPresetDto) {
    return {
      slug: this.normalizeSlug(dto.slug),
      title: dto.title,
      purpose: dto.purpose,
      format: dto.format ?? "prose",
      required: dto.required ?? false,
      extractionHints: dto.extractionHints ?? [],
      sortOrder: dto.sortOrder ?? 0
    };
  }

  private cleanTemplateSectionPresetUpdate(dto: Partial<TemplateSectionPresetDto>) {
    const data: Record<string, unknown> = {};
    if (dto.slug !== undefined) data.slug = this.normalizeSlug(dto.slug);
    if (dto.title !== undefined) data.title = dto.title;
    if (dto.purpose !== undefined) data.purpose = dto.purpose;
    if (dto.format !== undefined) data.format = dto.format;
    if (dto.required !== undefined) data.required = dto.required;
    if (dto.extractionHints !== undefined) data.extractionHints = dto.extractionHints;
    if (dto.sortOrder !== undefined) data.sortOrder = dto.sortOrder;
    return data;
  }

  private async cleanAdminUser(dto: AdminUserCreateDto | AdminUserUpdateDto, creating: boolean) {
    if (dto.role === "partner_admin" && !dto.partnerId) {
      throw new ConflictException("Partner admins must be assigned to a solution partner.");
    }
    const data: Record<string, unknown> = {};
    if (dto.email !== undefined) data.email = dto.email.toLowerCase();
    if (dto.fullName !== undefined) data.fullName = dto.fullName;
    if (dto.role !== undefined) data.role = dto.role;
    if (dto.partnerId !== undefined) data.partnerId = dto.partnerId || null;
    if ("password" in dto && dto.password) data.passwordHash = await bcrypt.hash(dto.password, 12);
    if (creating && !data.passwordHash) throw new ConflictException("Password is required.");
    return data as any;
  }

  private withoutPassword(user: any) {
    const { passwordHash: _passwordHash, ...safeUser } = user;
    return safeUser;
  }

  private cleanTenant(dto: Partial<TenantDto>) {
    return {
      name: dto.name,
      slug: dto.slug,
      legalName: dto.legalName,
      organizationNumber: dto.organizationNumber,
      contactName: dto.contactName,
      contactEmail: dto.contactEmail,
      contactPhone: dto.contactPhone,
      billingEmail: dto.billingEmail,
      addressLine1: dto.addressLine1,
      addressLine2: dto.addressLine2,
      postalCode: dto.postalCode,
      city: dto.city,
      country: dto.country ?? undefined,
      status: dto.status ?? undefined,
      notes: dto.notes,
      partnerId: dto.partnerId,
      configProfileId: dto.configProfileId
    };
  }

  private requireSuperadmin(req: any) {
    if (req.user?.role !== "superadmin") throw new ForbiddenException("Only superadmins can manage admin portal users and solution partners.");
  }

  private scopedPartnerId(req: any) {
    if (req.user?.role !== "partner_admin") return null;
    if (!req.user.partnerId) throw new ForbiddenException("Partner admin has no partner assignment.");
    return req.user.partnerId as string;
  }

  private async ensureAnotherSuperadmin(userId: string) {
    const user = await this.prisma.adminUser.findUnique({ where: { id: userId } });
    if (user?.role !== "superadmin") return;
    const otherSuperadmins = await this.prisma.adminUser.count({ where: { role: "superadmin", NOT: { id: userId } } });
    if (!otherSuperadmins) throw new ConflictException("At least one superadmin must remain.");
  }

  private async assertTenantAccess(req: any, tenantId: string) {
    const partnerId = this.scopedPartnerId(req);
    const tenant = await this.prisma.tenant.findFirst({ where: { id: tenantId, ...(partnerId ? { partnerId } : {}) } });
    if (!tenant) throw new ForbiddenException("Tenant is not available to this admin user.");
    return tenant;
  }

  private async assertConfigAccess(req: any, configProfileId: string) {
    const partnerId = this.scopedPartnerId(req);
    const profile = await this.prisma.configProfile.findFirst({ where: { id: configProfileId, ...(partnerId ? { partnerId } : {}) } });
    if (!profile) throw new ForbiddenException("Config profile is not available to this admin user.");
    return profile;
  }

  private async assertSingleKeyAccess(req: any, keyId: string) {
    const partnerId = this.scopedPartnerId(req);
    const key = await this.prisma.singleLicenseKey.findFirst({ where: { id: keyId, ...(partnerId ? { partnerId } : {}) } });
    if (!key) throw new ForbiddenException("License key is not available to this admin user.");
    return key;
  }

  private async assertEnterpriseKeyAccess(req: any, keyId: string) {
    const partnerId = this.scopedPartnerId(req);
    const key = await this.prisma.enterpriseLicenseKey.findFirst({
      where: { id: keyId, ...(partnerId ? { OR: [{ partnerId }, { tenant: { partnerId } }] } : {}) }
    });
    if (!key) throw new ForbiddenException("License key is not available to this admin user.");
    return key;
  }

  private templateFamilyInclude() {
    return {
      category: true,
      entitlements: { include: { tenant: true }, orderBy: { createdAt: "desc" as const } },
      variants: {
        orderBy: { language: "asc" as const },
        include: {
          draft: true,
          publishedVersions: { orderBy: [{ publishedAt: "desc" as const }, { createdAt: "desc" as const }] }
        }
      }
    };
  }

  private async assertTemplateFamilyAccess(req: any, familyId: string) {
    const partnerId = this.scopedPartnerId(req);
    const family = await this.prisma.templateFamily.findFirst({
      where: {
        id: familyId,
        ...(partnerId ? { entitlements: { some: { tenant: { partnerId } } } } : {})
      }
    });
    if (!family) throw new ForbiddenException("Template family is not available to this admin user.");
    return family;
  }

  private async assertTemplateVariantAccess(req: any, variantId: string) {
    const partnerId = this.scopedPartnerId(req);
    const variant = await this.prisma.templateVariant.findFirst({
      where: {
        id: variantId,
        ...(partnerId ? { family: { entitlements: { some: { tenant: { partnerId } } } } } : {})
      }
    });
    if (!variant) throw new ForbiddenException("Template variant is not available to this admin user.");
    return variant;
  }

  private async assertTemplateDraftAccess(req: any, draftId: string) {
    const partnerId = this.scopedPartnerId(req);
    const draft = await this.prisma.templateDraft.findFirst({
      where: {
        id: draftId,
        ...(partnerId ? { variant: { family: { entitlements: { some: { tenant: { partnerId } } } } } } : {})
      }
    });
    if (!draft) throw new ForbiddenException("Template draft is not available to this admin user.");
    return draft;
  }

  private async assertTemplateAccess(req: any, templateId: string) {
    const partnerId = this.scopedPartnerId(req);
    if (!partnerId) return;
    const template = await this.prisma.template.findFirst({ where: { id: templateId, tenant: { partnerId } } });
    if (!template) throw new ForbiddenException("Template is not available to this admin user.");
  }

  private async findScopedActivation(req: any, activationId: string) {
    const partnerId = this.scopedPartnerId(req);
    const activation = await this.prisma.deviceActivation.findFirst({
      where: {
        id: activationId,
        ...(partnerId ? { OR: [{ tenant: { partnerId } }, { enterpriseLicenseKey: { tenant: { partnerId } } }] } : {})
      }
    });
    if (!activation) throw new ForbiddenException("Device activation is not available to this admin user.");
    return activation;
  }

  private tenantLicenseUsage(tenant: { activations: Array<{ status: string; deviceIdentifier: string }>; enterpriseKeys: Array<{ maxDevices: number | null; status: string }> }) {
    const activeDevices = new Set(tenant.activations.filter((activation) => activation.status === "active").map((activation) => activation.deviceIdentifier));
    const totalDevices = new Set(tenant.activations.map((activation) => activation.deviceIdentifier));
    const activeKeys = tenant.enterpriseKeys.filter((key) => key.status === "active");
    const unlimited = activeKeys.some((key) => key.maxDevices == null);
    const licensedDevices = unlimited ? null : activeKeys.reduce((sum, key) => sum + (key.maxDevices ?? 0), 0);
    return {
      activeDevices: activeDevices.size,
      totalDevices: totalDevices.size,
      enterpriseKeys: tenant.enterpriseKeys.length,
      activeEnterpriseKeys: activeKeys.length,
      licensedDevices,
      unlimited,
      availableDevices: licensedDevices == null ? null : Math.max(licensedDevices - activeDevices.size, 0)
    };
  }
}
