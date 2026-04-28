import { z } from "zod";

export const ActivationStatus = z.enum(["active", "revoked", "expired", "disabled"]);

export const SingleActivationRequest = z.object({
  activationKey: z.string().min(12),
  deviceIdentifier: z.string().min(3),
  appVersion: z.string().min(1)
});

export const EnterpriseActivationRequest = SingleActivationRequest;

export const RefreshRequest = z.object({
  activationToken: z.string().min(20),
  appVersion: z.string().optional()
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
  id: z.string().optional(),
  title: z.string().min(2),
  language: z.string().min(2),
  sections: z.array(z.object({
    id: z.string().min(1),
    title: z.string().min(1),
    prompt: z.string().min(1)
  })).min(1)
});

export type ConfigProfilePayload = z.infer<typeof ConfigProfilePayload>;
export type SingleActivationRequest = z.infer<typeof SingleActivationRequest>;
export type EnterpriseActivationRequest = z.infer<typeof EnterpriseActivationRequest>;
export type RefreshRequest = z.infer<typeof RefreshRequest>;
export type TemplateMetadata = z.infer<typeof TemplateMetadata>;
