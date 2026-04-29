import { Body, Controller, Get, Post, Query, UseFilters } from "@nestjs/common";
import { IsOptional, IsString, MinLength } from "class-validator";
import { ApiBadRequestResponse, ApiBody, ApiForbiddenResponse, ApiNotFoundResponse, ApiOkResponse, ApiOperation, ApiProperty, ApiQuery, ApiTags } from "@nestjs/swagger";
import { ActivationService } from "./activation.service";
import { MobileExceptionFilter } from "./mobile-exception.filter";

class ActivateDto {
  @ApiProperty({ example: "ULFY-S-ABC123-DEF456-GHI789-JKL012", description: "Activation key manually entered by the iPhone user." })
  @IsString()
  @MinLength(12)
  activationKey!: string;

  @ApiProperty({ example: "ios-vendor-id-or-installation-id", description: "Stable app/device identifier used for device binding." })
  @IsString()
  @MinLength(3)
  deviceIdentifier!: string;

  @ApiProperty({ example: "C39XK123N72Q", required: false, description: "Optional physical device serial number or managed-device serial from MDM. Stored for admin audit/support, not used as the only binding secret." })
  @IsOptional()
  @IsString()
  deviceSerialNumber?: string;

  @ApiProperty({ example: "1.0.0", description: "Installed iPhone app version." })
  @IsString()
  appVersion!: string;
}

class RefreshDto {
  @ApiProperty({ example: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...", description: "Activation token returned by single or enterprise activation." })
  @IsString()
  @MinLength(20)
  activationToken!: string;

  @ApiProperty({ example: "ios-vendor-id-or-installation-id", required: false, description: "Optional device identifier to confirm/update during check-in." })
  @IsOptional()
  @IsString()
  deviceIdentifier?: string;

  @ApiProperty({ example: "C39XK123N72Q", required: false, description: "Optional device serial number to update during check-in." })
  @IsOptional()
  @IsString()
  deviceSerialNumber?: string;

  @ApiProperty({ example: "1.0.1", required: false })
  @IsOptional()
  @IsString()
  appVersion?: string;
}

@ApiTags("Mobile activation")
@UseFilters(MobileExceptionFilter)
@Controller()
export class ActivationController {
  constructor(private readonly activation: ActivationService) {}

  @Post("activate/single")
  @ApiOperation({ summary: "Activate a single-user license key", description: "Validates a single-user activation key, binds it to one device in v1, and returns a long-lived activation token for refresh/check-in." })
  @ApiBody({ type: ActivateDto })
  @ApiOkResponse({
    description: "Single-user license activated.",
    schema: {
      example: {
        success: true,
        activationToken: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
        activationId: "4b3d9ce0-8dd5-4f65-9198-71df8b5ff3c7",
        license: {
          type: "single",
          status: "active",
          registeredToName: "Ola Nordmann",
          registeredToEmail: "ola@example.com",
          activatedAt: "2026-04-29T10:15:00.000Z",
          maintenanceActive: true,
          maintenanceUntil: "2027-04-29T00:00:00.000Z"
        },
        device: {
          deviceIdentifier: "ios-vendor-id-or-installation-id",
          deviceSerialNumber: "C39XK123N72Q",
          lastSeenAt: "2026-04-29T10:15:00.000Z"
        },
        config: {}
      }
    }
  })
  @ApiNotFoundResponse({ description: "Activation key was not found.", schema: { example: { success: false, error: { code: "activation_key_invalid", message: "Activation key not found" } } } })
  @ApiForbiddenResponse({ description: "Key is revoked, expired, disabled, or already bound to another device.", schema: { example: { success: false, error: { code: "license_already_bound", message: "Activation key is already bound to another device" } } } })
  activateSingle(@Body() dto: ActivateDto) {
    return this.activation.activateSingle(dto);
  }

  @Post("activate/enterprise")
  @ApiOperation({ summary: "Activate an enterprise license key", description: "Validates an enterprise key, registers the device activation, and returns the tenant's effective central configuration profile." })
  @ApiBody({ type: ActivateDto })
  @ApiOkResponse({
    description: "Enterprise license activated and effective config returned.",
    schema: {
      example: {
        success: true,
        activationToken: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
        activationId: "c2dcfc17-8a83-4452-a9bb-952fd916510d",
        license: {
          type: "enterprise",
          status: "active",
          registeredToName: "Acme Health AS",
          registeredToEmail: "kari@acme.example",
          activatedAt: "2026-04-29T10:15:00.000Z",
          maintenanceActive: true,
          maintenanceUntil: "2027-04-29T00:00:00.000Z"
        },
        tenant: { id: "6c7a6b92-fd2e-4a52-aa42-c675502a11ce", name: "Acme Health", slug: "acme-health" },
        device: {
          deviceIdentifier: "ios-vendor-id-or-installation-id",
          deviceSerialNumber: "C39XK123N72Q",
          lastSeenAt: "2026-04-29T10:15:00.000Z"
        },
        config: {
          id: "b5e33e6f-5ff1-4e8d-a7cc-2f2e9781612f",
          name: "Default Enterprise Profile",
          speechProviderType: "azure",
          speechEndpointUrl: "http://192.168.222.171:5000",
          speechApiKey: "optional-managed-speech-key",
          privacyControlEnabled: true,
          piiControlEnabled: true,
          presidioEndpointUrl: "https://presidio.example.internal",
          presidioSecretRef: "secret://ulfy/presidio",
          privacyReviewProviderType: "local_heuristic",
          documentGenerationProviderType: "openai_compatible",
          documentGenerationEndpointUrl: "http://localhost:8000/v1",
          documentGenerationModel: "meta-llama/Meta-Llama-3.1-8B-Instruct",
          documentGenerationApiKey: "optional-managed-docgen-key",
          templateRepositoryUrl: "https://kvasetech.com/backend/api/v1/templates/manifest",
          telemetryEndpointUrl: "https://telemetry.example.internal/events",
          featureFlags: { enterpriseTemplates: true, privacyReview: true },
          allowedProviderRestrictions: ["azure", "openai_compatible", "local_heuristic"],
          defaultTemplateId: null
        }
      }
    }
  })
  @ApiNotFoundResponse({ description: "Enterprise key was not found.", schema: { example: { success: false, error: { code: "enterprise_key_invalid", message: "Enterprise key not found" } } } })
  @ApiForbiddenResponse({ description: "Enterprise key is unusable or device limit is reached.", schema: { example: { success: false, error: { code: "enterprise_device_limit_reached", message: "Enterprise device limit reached" } } } })
  activateEnterprise(@Body() dto: ActivateDto) {
    return this.activation.activateEnterprise(dto);
  }

  @Post("activation/refresh")
  @ApiOperation({ summary: "Refresh/check in an activation", description: "Validates the activation token, updates last check-in/app version, and returns current status/config." })
  @ApiBody({ type: RefreshDto })
  @ApiOkResponse({ description: "Activation token accepted.", schema: { example: { success: true, status: "active", kind: "enterprise", lastSeenAt: "2026-04-29T10:20:00.000Z", license: { type: "enterprise", status: "active", registeredToName: "Acme Health AS", registeredToEmail: "kari@acme.example", activatedAt: "2026-04-29T10:15:00.000Z", maintenanceActive: true, maintenanceUntil: "2027-04-29T00:00:00.000Z" }, tenant: { id: "6c7a6b92-fd2e-4a52-aa42-c675502a11ce", name: "Acme Health", slug: "acme-health" }, device: { deviceIdentifier: "ios-vendor-id-or-installation-id", deviceSerialNumber: "C39XK123N72Q", lastSeenAt: "2026-04-29T10:20:00.000Z" }, config: { id: "b5e33e6f-5ff1-4e8d-a7cc-2f2e9781612f", name: "Default Enterprise Profile", featureFlags: { enterpriseTemplates: true } } } } })
  @ApiForbiddenResponse({ description: "Invalid/revoked/disabled activation token.", schema: { example: { success: false, error: { code: "activation_token_invalid", message: "Invalid activation token" } } } })
  refresh(@Body() dto: RefreshDto) {
    return this.activation.refresh(dto);
  }

  @Get("config/effective")
  @ApiOperation({ summary: "Get effective enterprise config", description: "Returns the effective enterprise config for an activation token. Single-user activations return an empty config object." })
  @ApiQuery({ name: "activationToken", required: true, example: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..." })
  @ApiOkResponse({ description: "Effective config returned.", schema: { example: { success: true, tenant: { id: "6c7a6b92-fd2e-4a52-aa42-c675502a11ce", name: "Acme Health", slug: "acme-health" }, license: { type: "enterprise", status: "active", registeredToName: "Acme Health AS", registeredToEmail: "kari@acme.example", activatedAt: "2026-04-29T10:15:00.000Z", maintenanceActive: true, maintenanceUntil: "2027-04-29T00:00:00.000Z" }, config: { id: "b5e33e6f-5ff1-4e8d-a7cc-2f2e9781612f", name: "Default Enterprise Profile", privacyControlEnabled: true, featureFlags: { enterpriseTemplates: true } } } } })
  @ApiBadRequestResponse({ description: "Missing activationToken query parameter.", schema: { example: { success: false, error: { code: "activation_token_required", message: "activationToken query parameter is required" } } } })
  @ApiForbiddenResponse({ description: "Invalid activation token.", schema: { example: { success: false, error: { code: "activation_token_invalid", message: "Invalid activation token" } } } })
  effectiveConfig(@Query("activationToken") activationToken: string) {
    return this.activation.effectiveConfig(activationToken);
  }

  @Get("license/details")
  @ApiOperation({ summary: "Get mobile license details", description: "Returns complete license, tenant, device and config metadata for the iPhone Settings license view." })
  @ApiQuery({ name: "activationToken", required: true, example: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..." })
  @ApiOkResponse({ description: "License details returned.", schema: { example: { success: true, license: { type: "enterprise", status: "active", registeredToName: "Acme Health AS", registeredToEmail: "kari@acme.example", activatedAt: "2026-04-29T10:15:00.000Z", maintenanceActive: true, maintenanceUntil: "2027-04-29T00:00:00.000Z" }, tenant: { id: "6c7a6b92-fd2e-4a52-aa42-c675502a11ce", name: "Acme Health", slug: "acme-health" }, device: { deviceIdentifier: "ios-vendor-id-or-installation-id", deviceSerialNumber: "C39XK123N72Q", lastSeenAt: "2026-04-29T10:20:00.000Z" }, config: { id: "b5e33e6f-5ff1-4e8d-a7cc-2f2e9781612f", name: "Default Enterprise Profile" } } } })
  @ApiBadRequestResponse({ description: "Missing activationToken query parameter.", schema: { example: { success: false, error: { code: "activation_token_required", message: "activationToken query parameter is required" } } } })
  @ApiForbiddenResponse({ description: "Invalid activation token.", schema: { example: { success: false, error: { code: "activation_token_invalid", message: "Invalid activation token" } } } })
  licenseDetails(@Query("activationToken") activationToken: string) {
    return this.activation.licenseDetails(activationToken);
  }
}
