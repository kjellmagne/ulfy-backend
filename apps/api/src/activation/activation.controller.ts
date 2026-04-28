import { Body, Controller, Get, Post, Query } from "@nestjs/common";
import { IsOptional, IsString, MinLength } from "class-validator";
import { ApiBadRequestResponse, ApiBody, ApiForbiddenResponse, ApiNotFoundResponse, ApiOkResponse, ApiOperation, ApiProperty, ApiQuery, ApiTags } from "@nestjs/swagger";
import { ActivationService } from "./activation.service";

class ActivateDto {
  @ApiProperty({ example: "ULFY-S-ABC123-DEF456-GHI789-JKL012", description: "Activation key manually entered by the iPhone user." })
  @IsString()
  @MinLength(12)
  activationKey!: string;

  @ApiProperty({ example: "ios-vendor-id-or-installation-id", description: "Stable app/device identifier used for device binding." })
  @IsString()
  @MinLength(3)
  deviceIdentifier!: string;

  @ApiProperty({ example: "1.0.0", description: "Installed iPhone app version." })
  @IsString()
  appVersion!: string;
}

class RefreshDto {
  @ApiProperty({ example: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...", description: "Activation token returned by single or enterprise activation." })
  @IsString()
  @MinLength(20)
  activationToken!: string;

  @ApiProperty({ example: "1.0.1", required: false })
  @IsOptional()
  @IsString()
  appVersion?: string;
}

@ApiTags("Mobile activation")
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
        license: { type: "single", status: "active" },
        config: {}
      }
    }
  })
  @ApiNotFoundResponse({ description: "Activation key was not found.", schema: { example: { success: false, error: "Activation key not found" } } })
  @ApiForbiddenResponse({ description: "Key is revoked, expired, disabled, or already bound to another device.", schema: { example: { success: false, error: "Activation key is already bound to another device" } } })
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
        tenant: { id: "6c7a6b92-fd2e-4a52-aa42-c675502a11ce", name: "Acme Health", slug: "acme-health" },
        config: {
          id: "b5e33e6f-5ff1-4e8d-a7cc-2f2e9781612f",
          name: "Default Enterprise Profile",
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
          templateRepositoryUrl: "https://kvasetech.com/backend/api/v1/templates/manifest",
          telemetryEndpointUrl: "https://telemetry.example.internal/events",
          featureFlags: { enterpriseTemplates: true, privacyReview: true },
          allowedProviderRestrictions: ["openai-compatible", "internal"],
          defaultTemplateId: null
        }
      }
    }
  })
  @ApiNotFoundResponse({ description: "Enterprise key was not found.", schema: { example: { success: false, error: "Enterprise key not found" } } })
  @ApiForbiddenResponse({ description: "Enterprise key is unusable or device limit is reached.", schema: { example: { success: false, error: "Enterprise device limit reached" } } })
  activateEnterprise(@Body() dto: ActivateDto) {
    return this.activation.activateEnterprise(dto);
  }

  @Post("activation/refresh")
  @ApiOperation({ summary: "Refresh/check in an activation", description: "Validates the activation token, updates last check-in/app version, and returns current status/config." })
  @ApiBody({ type: RefreshDto })
  @ApiOkResponse({ description: "Activation token accepted.", schema: { example: { success: true, status: "active", kind: "enterprise", config: { featureFlags: { enterpriseTemplates: true } } } } })
  @ApiForbiddenResponse({ description: "Invalid/revoked/disabled activation token.", schema: { example: { success: false, error: "Invalid activation token" } } })
  refresh(@Body() dto: RefreshDto) {
    return this.activation.refresh(dto.activationToken, dto.appVersion);
  }

  @Get("config/effective")
  @ApiOperation({ summary: "Get effective enterprise config", description: "Returns the effective enterprise config for an activation token. Single-user activations return an empty config object." })
  @ApiQuery({ name: "activationToken", required: true, example: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..." })
  @ApiOkResponse({ description: "Effective config returned.", schema: { example: { tenantId: "6c7a6b92-fd2e-4a52-aa42-c675502a11ce", config: { name: "Default Enterprise Profile", privacyControlEnabled: true, featureFlags: { enterpriseTemplates: true } } } } })
  @ApiBadRequestResponse({ description: "Missing activationToken query parameter." })
  @ApiForbiddenResponse({ description: "Invalid activation token." })
  effectiveConfig(@Query("activationToken") activationToken: string) {
    return this.activation.effectiveConfig(activationToken);
  }
}
