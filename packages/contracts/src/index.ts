import { z } from "zod";

export const ActivationStatus = z.enum(["active", "revoked", "expired", "disabled"]);

export const SingleActivationRequest = z.object({
  activationKey: z.string().min(12),
  deviceIdentifier: z.string().min(3),
  deviceSerialNumber: z.string().min(1).optional(),
  appVersion: z.string().min(1)
});

export const EnterpriseActivationRequest = SingleActivationRequest;

export const RefreshRequest = z.object({
  activationToken: z.string().min(20),
  deviceIdentifier: z.string().min(3).optional(),
  deviceSerialNumber: z.string().min(1).optional(),
  appVersion: z.string().optional()
});

export const LicenseDetails = z.object({
  type: z.enum(["single", "enterprise"]),
  status: ActivationStatus,
  registeredToName: z.string().nullable(),
  registeredToEmail: z.string().email().nullable(),
  activatedAt: z.string().datetime().nullable(),
  maintenanceActive: z.boolean(),
  maintenanceUntil: z.string().datetime().nullable()
});

export const DeviceDetails = z.object({
  deviceIdentifier: z.string(),
  deviceSerialNumber: z.string().nullable(),
  lastSeenAt: z.string().datetime()
});

export const MobileErrorPayload = z.object({
  success: z.literal(false),
  error: z.object({
    code: z.string(),
    message: z.string()
  })
});

export const ConfigProfilePayload = z.object({
  speechProviderType: z.string().optional().nullable(),
  speechEndpointUrl: z.string().url().optional().nullable(),
  speechModelName: z.string().optional().nullable(),
  privacyControlEnabled: z.boolean().default(false),
  piiControlEnabled: z.boolean().default(false),
  presidioEndpointUrl: z.string().url().optional().nullable(),
  presidioSecretRef: z.string().optional().nullable(),
  privacyReviewProviderType: z.string().optional().nullable(),
  privacyReviewEndpointUrl: z.string().url().optional().nullable(),
  privacyReviewModel: z.string().optional().nullable(),
  documentGenerationProviderType: z.string().optional().nullable(),
  documentGenerationEndpointUrl: z.string().url().optional().nullable(),
  documentGenerationModel: z.string().optional().nullable(),
  templateRepositoryUrl: z.string().url().optional().nullable(),
  telemetryEndpointUrl: z.string().url().optional().nullable(),
  featureFlags: z.record(z.boolean()).default({}),
  allowedProviderRestrictions: z.array(z.string()).default([]),
  defaultTemplateId: z.string().uuid().optional().nullable()
});

export const TemplateMetadata = z.object({
  title: z.string().min(2),
  shortDescription: z.string().min(2),
  categoryId: z.string().uuid().optional().nullable(),
  language: z.string().min(2),
  icon: z.string().min(1),
  tags: z.array(z.string()).default([]),
  tenantId: z.string().uuid().optional().nullable()
});

export const TemplateYamlSchema = z.object({
  identity: z.object({
    id: z.string().uuid(),
    title: z.string().min(1).max(80),
    icon: z.string().optional().nullable(),
    short_description: z.string().max(200).optional().nullable(),
    category: z.string().min(1),
    tags: z.array(z.string()).default([]),
    language: z.string().min(2),
    version: z.string().regex(/^\d+\.\d+\.\d+$/)
  }).strict(),
  context: z.object({
    purpose: z.string().min(1),
    typical_setting: z.string().optional().nullable(),
    typical_participants: z.array(z.object({
      role: z.string().min(1),
      name: z.string().optional().nullable()
    }).strict()).default([]).optional(),
    goals: z.array(z.string()).default([]).optional(),
    related_processes: z.array(z.string()).default([]).optional()
  }).strict(),
  perspective: z.object({
    voice: z.string(),
    audience: z.string(),
    tone: z.string(),
    style_rules: z.array(z.string()).default([]).optional(),
    preserve_original_voice: z.boolean().optional()
  }).strict(),
  structure: z.object({
    sections: z.array(z.object({
      title: z.string().min(1),
      purpose: z.string().min(1),
      format: z.string(),
      required: z.boolean(),
      extraction_hints: z.array(z.string()).default([]).optional()
    }).strict()).min(1)
  }).strict(),
  content_rules: z.object({
    required_elements: z.array(z.string()).default([]).optional(),
    exclusions: z.array(z.string()).default([]).optional(),
    uncertainty_handling: z.string().optional().nullable(),
    action_item_format: z.string().optional().nullable(),
    decision_marker: z.string().optional().nullable(),
    speaker_attribution: z.string().optional().nullable()
  }).strict(),
  llm_prompting: z.object({
    system_prompt_additions: z.string().optional().nullable(),
    fallback_behavior: z.string().optional().nullable(),
    post_processing: z.object({
      extract_action_items: z.boolean().optional(),
      structured_output: z.record(z.any()).optional()
    }).strict().default({}).optional()
  }).strict()
}).strict();

export type ConfigProfilePayload = z.infer<typeof ConfigProfilePayload>;
export type SingleActivationRequest = z.infer<typeof SingleActivationRequest>;
export type EnterpriseActivationRequest = z.infer<typeof EnterpriseActivationRequest>;
export type RefreshRequest = z.infer<typeof RefreshRequest>;
export type LicenseDetails = z.infer<typeof LicenseDetails>;
export type DeviceDetails = z.infer<typeof DeviceDetails>;
export type MobileErrorPayload = z.infer<typeof MobileErrorPayload>;
export type TemplateMetadata = z.infer<typeof TemplateMetadata>;
