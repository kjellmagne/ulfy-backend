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

const activationTokenExample = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...";
const activationIdExample = "c2dcfc17-8a83-4452-a9bb-952fd916510d";
const tenantExample = {
  id: "6c7a6b92-fd2e-4a52-aa42-c675502a11ce",
  name: "Acme Health",
  slug: "acme-health",
  legalName: "Acme Health AS",
  organizationNumber: "999888777",
  contactName: "Kari Nordmann",
  contactEmail: "kari@acme.example",
  contactPhone: "+4712345678",
  billingEmail: "billing@acme.example",
  addressLine1: "Storgata 1",
  addressLine2: null,
  postalCode: "9008",
  city: "Tromso",
  country: "NO",
  status: "active"
};
const deviceExample = {
  deviceIdentifier: "ios-vendor-id-or-installation-id",
  deviceSerialNumber: "C39XK123N72Q",
  lastSeenAt: "2026-04-29T10:20:00.000Z"
};
const enterpriseLicenseExample = {
  type: "enterprise",
  status: "active",
  registeredToName: "Acme Health AS",
  registeredToEmail: "kari@acme.example",
  activatedAt: "2026-04-29T10:15:00.000Z",
  maintenanceActive: true,
  maintenanceUntil: "2027-04-29T00:00:00.000Z"
};
const singleLicenseExample = {
  type: "single",
  status: "active",
  registeredToName: "Ola Nordmann",
  registeredToEmail: "ola@example.com",
  activatedAt: "2026-04-29T10:15:00.000Z",
  maintenanceActive: true,
  maintenanceUntil: "2027-04-29T00:00:00.000Z"
};
const managedPolicyExample = {
  allowPolicyOverride: false,
  hideSettings: true,
  visibleSettingsWhenHidden: ["live_transcription_during_recording", "audio_source", "language", "privacy_prompt", "categories"],
  userMayChangeSpeechProvider: true,
  userMayChangeFormatter: false,
  managePrivacyControl: true,
  userMayChangePrivacyControl: false,
  managePIIControl: true,
  userMayChangePIIControl: false,
  managePrivacyReviewProvider: true,
  userMayChangePrivacyReviewProvider: false,
  managePrivacyPrompt: true,
  manageTemplateCategories: true
};
const templateCategoriesExample = [
  { id: "personlig_diktat", title: "Personlig diktat / logg", icon: "waveform.and.mic" },
  { id: "avdelingsmote", title: "Avdelingsmøte", icon: "person.3.sequence.fill" },
  { id: "oppfolgingssamtale", title: "Oppfølgingssamtale", icon: "arrow.triangle.2.circlepath" },
  { id: "jobbintervju", title: "Jobbintervju", icon: "person.text.rectangle" },
  { id: "kartleggingssamtale", title: "Kartleggingssamtale bruker", icon: "clipboard.fill" }
];
const enterpriseConfigExample = {
  id: "b5e33e6f-5ff1-4e8d-a7cc-2f2e9781612f",
  name: "Strict enterprise policy",
  speechProviderType: "azure",
  speechEndpointUrl: "https://kvasetech.com/stt",
  speechModelName: null,
  speechApiKey: "optional-managed-speech-key",
  privacyControlEnabled: true,
  piiControlEnabled: true,
  presidioEndpointUrl: "https://presidio.example.internal",
  presidioSecretRef: "secret://ulfy/presidio",
  presidioApiKey: "optional-managed-presidio-key",
  presidioScoreThreshold: 0.35,
  presidioFullPersonNamesOnly: true,
  presidioDetectPerson: true,
  presidioDetectEmail: true,
  presidioDetectPhone: true,
  presidioDetectLocation: true,
  presidioDetectIdentifier: true,
  privacyReviewProviderType: "openai_compatible",
  privacyReviewEndpointUrl: "https://privacy.example.internal/v1",
  privacyReviewModel: "privacy-review-v1",
  privacyReviewApiKey: "optional-managed-privacy-review-key",
  privacyPrompt: "Review the transcript for sensitive personal information before document generation. Prefer caution when uncertain.",
  documentGenerationProviderType: "openai_compatible",
  documentGenerationEndpointUrl: "https://api.openai.com/v1",
  documentGenerationModel: "gpt-5-mini",
  documentGenerationApiKey: "optional-managed-docgen-key",
  templateRepositoryUrl: "https://kvasetech.com/backend/api/v1/templates/manifest",
  telemetryEndpointUrl: "https://telemetry.example.internal/events",
  featureFlags: { developerMode: false, allowExternalProviders: false },
  allowedProviderRestrictions: ["azure", "openai_compatible", "local_heuristic"],
  templateCategories: templateCategoriesExample,
  providerProfiles: {
    speech: {
      selected: "azure",
      available: ["local", "apple_online", "azure"],
      providers: {
        local: { type: "local", name: "Local", enabled: true, endpointUrl: null, modelName: null, privacyClass: "Safe", ready: true },
        apple_online: { type: "apple_online", name: "Apple Online", enabled: true, endpointUrl: null, modelName: null, privacyClass: "Use with caution", ready: true },
        azure: { type: "azure", name: "Azure / on-prem speech", enabled: true, endpointUrl: "https://kvasetech.com/stt", modelName: null, privacyClass: "Safe", ready: true }
      }
    },
    formatter: {
      selected: "openai_compatible",
      selectedProviderId: "openai_compatible",
      available: ["apple_intelligence", "openai_compatible"],
      providers: [
        { id: "apple_intelligence", name: "Apple Intelligence", type: "apple_intelligence", enabled: true, builtIn: true, endpointUrl: null, modelName: null, privacyEmphasis: "safe" },
        { id: "openai_compatible", name: "OpenAI-compatible", type: "openai_compatible", enabled: true, builtIn: true, endpointUrl: "https://api.openai.com/v1", modelName: "gpt-5-mini", privacyEmphasis: "managed" }
      ]
    }
  },
  managedPolicy: managedPolicyExample,
  defaultTemplateId: "00000000-0000-4000-8000-000000000401"
};

const mobileErrorSchema = {
  type: "object",
  required: ["success", "error"],
  properties: {
    success: { type: "boolean", enum: [false], description: "Always false for mobile-facing errors." },
    error: {
      type: "object",
      required: ["code", "message"],
      properties: {
        code: { type: "string", example: "activation_key_invalid", description: "Stable machine-readable error code for the iOS client." },
        message: { type: "string", example: "Activation key not found", description: "Short human-readable message suitable for logging or simple UI display." }
      }
    }
  }
};

const licenseSchema = {
  type: "object",
  required: ["type", "status", "registeredToName", "registeredToEmail", "activatedAt", "maintenanceActive", "maintenanceUntil"],
  description: "Server-side license metadata for the Settings license view.",
  properties: {
    type: { type: "string", enum: ["single", "enterprise"], description: "License family activated by the device." },
    status: { type: "string", enum: ["active", "revoked", "expired", "disabled"], description: "Current server-side license status." },
    registeredToName: { type: "string", nullable: true, description: "Purchaser name for single licenses, or tenant legal/name for enterprise licenses." },
    registeredToEmail: { type: "string", nullable: true, description: "Purchaser email for single licenses, or tenant contact/billing email for enterprise licenses." },
    activatedAt: { type: "string", format: "date-time", nullable: true, description: "When this license/device activation was first created." },
    maintenanceActive: { type: "boolean", description: "True when the license is active and maintenance has not expired." },
    maintenanceUntil: { type: "string", format: "date-time", nullable: true, description: "Maintenance/support end timestamp, or null when no expiry is set." }
  }
};

const tenantSchema = {
  type: "object",
  nullable: true,
  description: "Enterprise tenant/customer details. Null for single-user activations.",
  properties: {
    id: { type: "string", format: "uuid" },
    name: { type: "string", description: "Short display name." },
    slug: { type: "string", description: "Stable tenant slug." },
    legalName: { type: "string", nullable: true },
    organizationNumber: { type: "string", nullable: true },
    contactName: { type: "string", nullable: true },
    contactEmail: { type: "string", nullable: true },
    contactPhone: { type: "string", nullable: true },
    billingEmail: { type: "string", nullable: true },
    addressLine1: { type: "string", nullable: true },
    addressLine2: { type: "string", nullable: true },
    postalCode: { type: "string", nullable: true },
    city: { type: "string", nullable: true },
    country: { type: "string", nullable: true },
    status: { type: "string", nullable: true }
  }
};

const deviceSchema = {
  type: "object",
  required: ["deviceIdentifier", "deviceSerialNumber", "lastSeenAt"],
  description: "Registered device details and the server's last license check-in timestamp.",
  properties: {
    deviceIdentifier: { type: "string", description: "Stable iOS/app identifier used for license binding." },
    deviceSerialNumber: { type: "string", nullable: true, description: "Optional physical/MDM serial number. Useful for support and enterprise inventory." },
    lastSeenAt: { type: "string", format: "date-time", description: "Updated whenever the app activates or refreshes the license." }
  }
};

const managedPolicySchema = {
  type: "object",
  description: [
    "Controls whether centrally managed values may be changed locally by the user.",
    "allowPolicyOverride is the master bypass. managePrivacyControl, managePIIControl and managePrivacyReviewProvider decide whether saved privacy fields are emitted as policy at all.",
    "Granular userMayChange flags allow only one area to change after policy is applied.",
    "Client logic should treat canChangeFormatter as allowPolicyOverride || userMayChangeFormatter, canChangePrivacyControl as allowPolicyOverride || userMayChangePrivacyControl, canChangePIIControl as allowPolicyOverride || userMayChangePIIControl, and canChangePrivacyReview as allowPolicyOverride || userMayChangePrivacyReviewProvider.",
    "When this object is missing, the iOS app should use strict defaults."
  ].join(" "),
  properties: {
    allowPolicyOverride: { type: "boolean", default: false, description: "Master override. false means strict central policy; true allows temporary local policy bypass." },
    allowLocalOverride: { type: "boolean", description: "Accepted alias for allowPolicyOverride." },
    userMayOverridePolicy: { type: "boolean", description: "Accepted alias for allowPolicyOverride." },
    hideSettings: { type: "boolean", default: false, description: "When true, the iOS app should hide or strongly minimize local settings screens for managed areas." },
    hideAppSettings: { type: "boolean", description: "Accepted alias for hideSettings." },
    hideSettingsUI: { type: "boolean", description: "Accepted alias for hideSettings." },
    visibleSettingsWhenHidden: {
      type: "array",
      description: [
        "Optional exceptions applied only when hideSettings is true.",
        "Missing or empty means strict hide-most-settings behavior.",
        "Each value identifies an app setting/menu item that may remain visible and editable while the rest of Settings is hidden.",
        "This list controls visibility only; it does not centrally manage the setting value.",
        "The language value means app UI language, not speech transcription language or template/transcript output language."
      ].join(" "),
      items: {
        type: "string",
        enum: [
          "live_transcription_during_recording",
          "audio_source",
          "language",
          "privacy_info",
          "dim_screen_during_recording",
          "optimize_openai_recording",
          "privacy_prompt",
          "categories"
        ]
      },
      example: ["live_transcription_during_recording", "audio_source", "language", "privacy_prompt", "categories"]
    },
    settingsVisibleWhenHidden: { type: "array", items: { type: "string" }, description: "Accepted alias for visibleSettingsWhenHidden." },
    allowedSettingsWhenHidden: { type: "array", items: { type: "string" }, description: "Accepted alias for visibleSettingsWhenHidden." },
    userMayChangeSpeechProvider: { type: "boolean", default: false, description: "Allows the user to choose another speech provider locally without enabling full policy override." },
    userMayChangeSpeech: { type: "boolean", description: "Accepted alias for userMayChangeSpeechProvider." },
    allowSpeechProviderChange: { type: "boolean", description: "Accepted alias for userMayChangeSpeechProvider." },
    userMayChangeFormatter: { type: "boolean", default: false, description: "Allows the user to choose another document-generation formatter locally." },
    userMayChangeDocumentGenerationProvider: { type: "boolean", description: "Accepted alias for userMayChangeFormatter." },
    allowFormatterChange: { type: "boolean", description: "Accepted alias for userMayChangeFormatter." },
    managePrivacyControl: { type: "boolean", default: false, description: "When true, config.privacyControlEnabled is sent to the app as the managed master privacy-control value. When false, privacyControlEnabled is omitted and the app keeps its local value." },
    privacyControlManaged: { type: "boolean", description: "Accepted alias for managePrivacyControl." },
    userMayChangePrivacyControl: { type: "boolean", default: false, description: "Allows the user to change the master privacy-control switch locally after the managed value is applied." },
    allowPrivacyControlChange: { type: "boolean", description: "Accepted alias for userMayChangePrivacyControl." },
    managePIIControl: { type: "boolean", default: false, description: "When true, config.piiControlEnabled and Presidio analyzer fields are sent to the app as managed policy. When false, PII settings are omitted and the app keeps local Presidio settings." },
    piiControlManaged: { type: "boolean", description: "Accepted alias for managePIIControl." },
    userMayChangePIIControl: { type: "boolean", default: false, description: "Allows the user to change the Presidio PII analyzer switch and Presidio analyzer settings locally after policy is applied." },
    allowPIIControlChange: { type: "boolean", description: "Accepted alias for userMayChangePIIControl." },
    managePrivacyReviewProvider: { type: "boolean", default: false, description: "When true, config.privacyReviewProviderType and review endpoint/model/key are sent to the app as managed privacy-review/guardrail policy. When false, those fields are omitted and the app keeps local review provider settings." },
    privacyReviewProviderManaged: { type: "boolean", description: "Accepted alias for managePrivacyReviewProvider." },
    managePrivacyReview: { type: "boolean", description: "Accepted alias for managePrivacyReviewProvider." },
    userMayChangePrivacyReviewProvider: { type: "boolean", default: false, description: "Allows the user to choose another privacy-review/guardrail provider locally." },
    userMayChangePrivacyReview: { type: "boolean", description: "Accepted alias for userMayChangePrivacyReviewProvider." },
    allowPrivacyReviewProviderChange: { type: "boolean", description: "Accepted alias for userMayChangePrivacyReviewProvider." },
    managePrivacyPrompt: { type: "boolean", default: false, description: "When true, the backend sends config.privacyPrompt and the iOS app uses it as the managed Personvern prompt. When false, privacyPrompt is omitted from mobile config and the app uses the built-in or local app prompt." },
    privacyPromptManaged: { type: "boolean", description: "Accepted alias for managePrivacyPrompt." },
    manageTemplateCategories: { type: "boolean", default: true, description: "When true, the backend sends the central template category catalog and the iOS app treats category names/icons/order as organization-managed. Profiles default to managed categories unless explicitly set to false." },
    templateCategoriesManaged: { type: "boolean", description: "Accepted alias for manageTemplateCategories." }
  },
  additionalProperties: true,
  example: managedPolicyExample
};

const mobileConfigSchema = {
  type: "object",
  description: [
    "Effective enterprise-managed configuration for the iOS app.",
    "The payload is sparse by design: if a field is omitted, the app should leave the corresponding local setting unchanged.",
    "If a field is present, the app should treat it as an intentional managed policy value.",
    "documentGenerationProviderType and privacyReviewProviderType intentionally use openai_compatible for OpenAI, vLLM and OpenAI-compatible gateways; the endpoint/model/API key define the actual backend."
  ].join(" "),
  properties: {
    id: { type: "string", format: "uuid", description: "Config profile id." },
    name: { type: "string", description: "Config profile display name." },
    speechProviderType: { type: "string", enum: ["local", "apple_online", "openai", "azure", "gemini"], description: "Managed speech provider decoded by the iOS app. Enterprise policy profiles normally use local, apple_online, openai or azure." },
    speechEndpointUrl: { type: "string", nullable: true, example: "https://kvasetech.com/stt", description: "Speech endpoint URL for endpoint-driven providers such as Azure/STT container or internal gateways." },
    speechModelName: { type: "string", nullable: true, example: "gpt-4o-transcribe", description: "Optional speech model. Mainly used by OpenAI speech." },
    speechApiKey: { type: "string", nullable: true, description: "Optional managed speech credential. The app stores it securely and uses it only for the managed speech provider." },
    privacyControlEnabled: { type: "boolean", nullable: true, description: "Master privacy-control toggle. Sent only when managedPolicy.managePrivacyControl is true. When omitted/null, the app keeps the local value. When present, this manages/locks privacy control unless policy allows local change." },
    piiControlEnabled: { type: "boolean", nullable: true, description: "Enables the Presidio PII step inside privacy control. Sent only when managedPolicy.managePIIControl is true. When omitted/null, the app keeps the local PII toggle." },
    presidioEndpointUrl: { type: "string", nullable: true, example: "https://presidio.example.internal", description: "Base URL for Microsoft Presidio Analyzer. The app appends /health and /analyze." },
    presidioSecretRef: { type: "string", nullable: true, description: "Backend-side secret reference for Presidio. Present for compatibility; the app does not dereference it." },
    presidioApiKey: { type: "string", nullable: true, description: "Optional managed Presidio credential. The app sends it as Authorization: Bearer, X-API-Key and apikey for gateway compatibility." },
    presidioScoreThreshold: { type: "number", minimum: 0, maximum: 1, nullable: true, example: 0.35, description: "Minimum Presidio detection confidence." },
    presidioFullPersonNamesOnly: { type: "boolean", nullable: true, description: "When true, only full person names should trigger the person-name rule." },
    presidioDetectPerson: { type: "boolean", nullable: true, description: "Detect person names." },
    presidioDetectEmail: { type: "boolean", nullable: true, description: "Detect email addresses." },
    presidioDetectPhone: { type: "boolean", nullable: true, description: "Detect phone numbers." },
    presidioDetectLocation: { type: "boolean", nullable: true, description: "Detect places and addresses." },
    presidioDetectIdentifier: { type: "boolean", nullable: true, description: "Detect other identifiers such as IDs or case numbers." },
    privacyReviewProviderType: { type: "string", enum: ["local_heuristic", "openai_compatible", "ollama"], nullable: true, description: "Privacy review/guardrail provider. Sent only when managedPolicy.managePrivacyReviewProvider is true. OpenAI and vLLM should be represented as openai_compatible plus endpoint/model/API key." },
    privacyReviewEndpointUrl: { type: "string", nullable: true, example: "https://privacy.example.internal/v1", description: "Endpoint URL for privacy-review providers. Hidden/unused for local_heuristic." },
    privacyReviewModel: { type: "string", nullable: true, example: "privacy-review-v1", description: "Model identifier for the privacy-review step." },
    privacyReviewApiKey: { type: "string", nullable: true, description: "Optional managed privacy-review credential. Used for openai_compatible or authenticated Ollama/gateway setups." },
    privacyPrompt: { type: "string", nullable: true, description: "Optional centrally managed privacy prompt shown or used by the app for privacy review guidance. Sent only when managedPolicy.managePrivacyPrompt is true; if omitted, the app should keep its built-in or local prompt." },
    documentGenerationProviderType: { type: "string", enum: ["apple_intelligence", "openai_compatible", "ollama"], nullable: true, description: "Document generation formatter provider. OpenAI, vLLM and internal OpenAI-style gateways are all openai_compatible." },
    documentGenerationEndpointUrl: { type: "string", nullable: true, example: "https://api.openai.com/v1", description: "Endpoint URL for document-generation provider. Hidden/unused for Apple Intelligence." },
    documentGenerationModel: { type: "string", nullable: true, example: "gpt-5-mini", description: "Model identifier for document generation." },
    documentGenerationApiKey: { type: "string", nullable: true, description: "Optional managed document-generation credential. The app stores it securely and uses it only for the managed formatter provider." },
    templateRepositoryUrl: { type: "string", nullable: true, example: "https://kvasetech.com/backend/api/v1/templates/manifest", description: "Enterprise template catalog URL. App should authenticate repository calls with Authorization: Bearer <activationToken>." },
    telemetryEndpointUrl: { type: "string", nullable: true, description: "Optional telemetry endpoint for enterprise deployments." },
    featureFlags: {
      type: "object",
      additionalProperties: { type: "boolean" },
      description: "Boolean feature flags decoded by the app, including developerMode and allowExternalProviders."
    },
    allowedProviderRestrictions: { type: "array", items: { type: "string" }, description: "Policy hint/list of allowed provider identifiers for clients that support provider filtering." },
    templateCategories: {
      type: "array",
      description: [
        "Optional centrally managed template category catalog for the iOS app.",
        "id is the canonical category value stored in template YAML identity.category and returned as manifest.category.",
        "title and icon are display metadata; icon is an SF Symbol name.",
        "Array order is the display order. If this field is missing or empty, the app should keep local/default category definitions and local category editing behavior."
      ].join(" "),
      items: {
        type: "object",
        required: ["id", "title", "icon"],
        properties: {
          id: { type: "string", example: "oppfolgingssamtale", description: "Canonical category id/slug. Must match YAML identity.category and manifest category." },
          title: { type: "string", example: "Oppfølgingssamtale", description: "Display title shown in the app." },
          icon: { type: "string", example: "arrow.triangle.2.circlepath", description: "SF Symbol name shown by the app." }
        }
      },
      example: templateCategoriesExample
    },
    providerProfiles: {
      type: "object",
      description: "Provider catalog for enterprise clients. Contains available speech providers and document-generation provider profiles, including tenant-specific OpenAI-compatible/Ollama endpoints. The selected top-level speech/documentGeneration fields remain the default/enforced provider.",
      example: {
        speech: {
          selected: "azure",
          available: ["local", "apple_online", "azure"],
          providers: {
            azure: { type: "azure", name: "Azure / on-prem speech", enabled: true, endpointUrl: "https://kvasetech.com/stt", modelName: null, privacyClass: "Safe" }
          }
        },
        formatter: {
          selected: "openai_compatible",
          selectedProviderId: "openai_compatible",
          available: ["apple_intelligence", "openai_compatible"],
          providers: [
            { id: "apple_intelligence", name: "Apple Intelligence", type: "apple_intelligence", enabled: true, builtIn: true, privacyEmphasis: "safe" },
            { id: "openai_compatible", name: "OpenAI-compatible", type: "openai_compatible", enabled: true, builtIn: true, endpointUrl: "https://api.openai.com/v1", modelName: "gpt-5-mini", privacyEmphasis: "managed" }
          ]
        }
      }
    },
    managedPolicy: managedPolicySchema,
    defaultTemplateId: { type: "string", format: "uuid", nullable: true, description: "Optional tenant default template id used to guide users toward an organization-approved starting template." }
  },
  additionalProperties: true,
  example: enterpriseConfigExample
};

const activationRefreshExample = {
  success: true,
  status: "active",
  kind: "enterprise",
  lastSeenAt: "2026-04-29T10:20:00.000Z",
  license: enterpriseLicenseExample,
  tenant: tenantExample,
  device: deviceExample,
  config: enterpriseConfigExample
};

const singleActivationResponseSchema = {
  type: "object",
  required: ["success", "activationToken", "activationId", "license", "device", "config"],
  properties: {
    success: { type: "boolean", enum: [true] },
    activationToken: { type: "string", description: "JWT-like activation token. Store securely on the device and send for refresh/config/template repository calls." },
    activationId: { type: "string", format: "uuid", description: "Server id for this device activation." },
    license: { ...licenseSchema, example: singleLicenseExample },
    device: { ...deviceSchema, example: { ...deviceExample, lastSeenAt: "2026-04-29T10:15:00.000Z" } },
    config: { type: "object", description: "Single-user licenses do not receive central enterprise config in v1.", example: {} }
  },
  example: {
    success: true,
    activationToken: activationTokenExample,
    activationId: "4b3d9ce0-8dd5-4f65-9198-71df8b5ff3c7",
    license: singleLicenseExample,
    device: { ...deviceExample, lastSeenAt: "2026-04-29T10:15:00.000Z" },
    config: {}
  }
};

const enterpriseActivationResponseSchema = {
  type: "object",
  required: ["success", "activationToken", "activationId", "license", "tenant", "device", "config"],
  properties: {
    success: { type: "boolean", enum: [true] },
    activationToken: { type: "string", description: "Activation token used by refresh/config/license-details and template repository calls." },
    activationId: { type: "string", format: "uuid", description: "Server id for this device activation." },
    license: { ...licenseSchema, example: enterpriseLicenseExample },
    tenant: { ...tenantSchema, example: tenantExample },
    device: { ...deviceSchema, example: { ...deviceExample, lastSeenAt: "2026-04-29T10:15:00.000Z" } },
    config: mobileConfigSchema
  },
  example: {
    success: true,
    activationToken: activationTokenExample,
    activationId: activationIdExample,
    license: enterpriseLicenseExample,
    tenant: tenantExample,
    device: { ...deviceExample, lastSeenAt: "2026-04-29T10:15:00.000Z" },
    config: enterpriseConfigExample
  }
};

const refreshResponseSchema = {
  type: "object",
  required: ["success", "status", "kind", "lastSeenAt", "license", "tenant", "device", "config"],
  properties: {
    success: { type: "boolean", enum: [true] },
    status: { type: "string", enum: ["active", "revoked", "expired", "disabled"], description: "Current activation status." },
    kind: { type: "string", enum: ["single", "enterprise"], description: "Activation kind." },
    lastSeenAt: { type: "string", format: "date-time", description: "Server timestamp for this refresh/check-in." },
    license: licenseSchema,
    tenant: tenantSchema,
    device: deviceSchema,
    config: mobileConfigSchema
  },
  example: activationRefreshExample
};

const effectiveConfigResponseSchema = {
  type: "object",
  required: ["success", "tenant", "license", "config"],
  properties: {
    success: { type: "boolean", enum: [true] },
    tenant: tenantSchema,
    license: licenseSchema,
    config: mobileConfigSchema
  },
  example: {
    success: true,
    tenant: tenantExample,
    license: enterpriseLicenseExample,
    config: enterpriseConfigExample
  }
};

const licenseDetailsResponseSchema = {
  type: "object",
  required: ["success", "license", "tenant", "device", "config"],
  properties: {
    success: { type: "boolean", enum: [true] },
    license: licenseSchema,
    tenant: tenantSchema,
    device: deviceSchema,
    config: mobileConfigSchema
  },
  example: {
    success: true,
    license: enterpriseLicenseExample,
    tenant: tenantExample,
    device: deviceExample,
    config: enterpriseConfigExample
  }
};

@ApiTags("Mobile activation")
@UseFilters(MobileExceptionFilter)
@Controller()
export class ActivationController {
  constructor(private readonly activation: ActivationService) {}

  @Post("activate/single")
  @ApiOperation({
    summary: "Activate a single-user license key",
    description: [
      "Validates a single-user activation key, binds it to one device in v1, and returns a long-lived activation token for refresh/check-in.",
      "Single-user activations do not receive an enterprise config profile; config is an empty object.",
      "The iOS app should store activationToken securely and use /activation/refresh for license validity checks."
    ].join(" ")
  })
  @ApiBody({ type: ActivateDto })
  @ApiOkResponse({ description: "Single-user license activated.", schema: singleActivationResponseSchema })
  @ApiNotFoundResponse({ description: "Activation key was not found.", schema: { ...mobileErrorSchema, example: { success: false, error: { code: "activation_key_invalid", message: "Activation key not found" } } } })
  @ApiForbiddenResponse({
    description: "Key is revoked, expired, disabled, or already bound to another device.",
    schema: { ...mobileErrorSchema, example: { success: false, error: { code: "license_already_bound", message: "Activation key is already bound to another device" } } }
  })
  activateSingle(@Body() dto: ActivateDto) {
    return this.activation.activateSingle(dto);
  }

  @Post("activate/enterprise")
  @ApiOperation({
    summary: "Activate an enterprise license key",
    description: [
      "Validates an enterprise key, registers the device activation, and returns the tenant's effective central configuration profile.",
      "The config object uses sparse managed policy semantics: omitted fields must not overwrite local app settings, while present fields are intentional central policy.",
      "Template repository access should use the returned activationToken as a bearer token."
    ].join(" ")
  })
  @ApiBody({ type: ActivateDto })
  @ApiOkResponse({ description: "Enterprise license activated and effective config returned.", schema: enterpriseActivationResponseSchema })
  @ApiNotFoundResponse({ description: "Enterprise key was not found.", schema: { ...mobileErrorSchema, example: { success: false, error: { code: "enterprise_key_invalid", message: "Enterprise key not found" } } } })
  @ApiForbiddenResponse({
    description: "Enterprise key is unusable or device limit is reached.",
    schema: { ...mobileErrorSchema, example: { success: false, error: { code: "enterprise_device_limit_reached", message: "Enterprise device limit reached" } } }
  })
  activateEnterprise(@Body() dto: ActivateDto) {
    return this.activation.activateEnterprise(dto);
  }

  @Post("activation/refresh")
  @ApiOperation({
    summary: "Refresh/check in an activation",
    description: [
      "Validates the activation token, updates last check-in/app version/serial, and returns current license status plus config metadata.",
      "The iOS Settings view should prefer this response over old cached license details after every successful check-in.",
      "For enterprise activations, the config object is the current effective profile and includes tenant policy changes."
    ].join(" ")
  })
  @ApiBody({ type: RefreshDto })
  @ApiOkResponse({ description: "Activation token accepted.", schema: refreshResponseSchema })
  @ApiForbiddenResponse({ description: "Invalid/revoked/disabled activation token.", schema: { ...mobileErrorSchema, example: { success: false, error: { code: "activation_token_invalid", message: "Invalid activation token" } } } })
  refresh(@Body() dto: RefreshDto) {
    return this.activation.refresh(dto);
  }

  @Get("config/effective")
  @ApiOperation({
    summary: "Get effective enterprise config",
    description: [
      "Returns the current effective enterprise config for an activation token.",
      "Use this when the app wants a fresh central policy without performing a full refresh body update.",
      "Single-user activations return tenant null and an empty config object."
    ].join(" ")
  })
  @ApiQuery({ name: "activationToken", required: true, example: activationTokenExample, description: "Activation token from /activate/single or /activate/enterprise." })
  @ApiOkResponse({ description: "Effective config returned.", schema: effectiveConfigResponseSchema })
  @ApiBadRequestResponse({ description: "Missing activationToken query parameter.", schema: { ...mobileErrorSchema, example: { success: false, error: { code: "activation_token_required", message: "activationToken query parameter is required" } } } })
  @ApiForbiddenResponse({ description: "Invalid activation token.", schema: { ...mobileErrorSchema, example: { success: false, error: { code: "activation_token_invalid", message: "Invalid activation token" } } } })
  effectiveConfig(@Query("activationToken") activationToken: string) {
    return this.activation.effectiveConfig(activationToken);
  }

  @Get("license/details")
  @ApiOperation({
    summary: "Get mobile license details",
    description: "Returns complete license, tenant, device and config metadata for the iPhone Settings license status/details dialog."
  })
  @ApiQuery({ name: "activationToken", required: true, example: activationTokenExample, description: "Activation token from /activate/single or /activate/enterprise." })
  @ApiOkResponse({ description: "License details returned.", schema: licenseDetailsResponseSchema })
  @ApiBadRequestResponse({ description: "Missing activationToken query parameter.", schema: { ...mobileErrorSchema, example: { success: false, error: { code: "activation_token_required", message: "activationToken query parameter is required" } } } })
  @ApiForbiddenResponse({ description: "Invalid activation token.", schema: { ...mobileErrorSchema, example: { success: false, error: { code: "activation_token_invalid", message: "Invalid activation token" } } } })
  licenseDetails(@Query("activationToken") activationToken: string) {
    return this.activation.licenseDetails(activationToken);
  }
}
