import { describe, expect, it } from "vitest";
import { ConfigProfilePayload, ManagedPolicyPayload } from "@ulfy/contracts";
import { enrichOpenApiDescriptions } from "../src/openapi/descriptions";

describe("API contract documentation", () => {
  it("keeps managed privacy policy switches in the shared contracts package", () => {
    const managedPolicy = ManagedPolicyPayload.parse({
      managePrivacyControl: true,
      userMayChangePrivacyControl: false,
      managePIIControl: true,
      userMayChangePIIControl: true,
      managePrivacyReviewProvider: true,
      userMayChangePrivacyReviewProvider: false,
      managePrivacyPrompt: true
    });

    expect(managedPolicy).toMatchObject({
      managePrivacyControl: true,
      userMayChangePrivacyControl: false,
      managePIIControl: true,
      userMayChangePIIControl: true,
      managePrivacyReviewProvider: true,
      userMayChangePrivacyReviewProvider: false,
      managePrivacyPrompt: true
    });

    const config = ConfigProfilePayload.parse({
      privacyControlEnabled: true,
      piiControlEnabled: true,
      privacyReviewProviderType: "openai_compatible",
      managedPolicy
    });

    expect(config.managedPolicy?.managePrivacyControl).toBe(true);
    expect(config.managedPolicy?.managePIIControl).toBe(true);
    expect(config.managedPolicy?.managePrivacyReviewProvider).toBe(true);
  });

  it("marks direct-template endpoints as legacy in the OpenAPI document", () => {
    const document: any = enrichOpenApiDescriptions({
      paths: {
        "/api/v1/admin/templates": {
          get: {},
          post: {}
        },
        "/api/v1/admin/templates/{id}": {
          patch: {}
        },
        "/api/v1/admin/templates/{id}/publish/{versionId}": {
          post: {}
        },
        "/api/v1/admin/templates/{id}/archive": {
          patch: {}
        }
      }
    });

    const legacyOperations = [
      document.paths["/api/v1/admin/templates"].get,
      document.paths["/api/v1/admin/templates"].post,
      document.paths["/api/v1/admin/templates/{id}"].patch,
      document.paths["/api/v1/admin/templates/{id}/publish/{versionId}"].post,
      document.paths["/api/v1/admin/templates/{id}/archive"].patch
    ];

    for (const operation of legacyOperations) {
      expect(operation.deprecated).toBe(true);
      expect(operation["x-ulfy-status"]).toBe("legacy");
      expect(operation["x-ulfy-replacement"]).toBeTruthy();
      expect(operation.description).toMatch(/Legacy|legacy/);
    }
  });

  it("marks the tenantId manifest query as a disabled legacy fallback", () => {
    const document: any = enrichOpenApiDescriptions({
      paths: {
        "/api/v1/templates/manifest": {
          get: {
            parameters: [
              { name: "tenantId", in: "query", description: "Optional internal tenant filter." },
              { name: "Authorization", in: "header", description: "Bearer activation token." }
            ]
          }
        }
      }
    });

    const parameters = document.paths["/api/v1/templates/manifest"].get.parameters;
    const tenantId = parameters.find((parameter: any) => parameter.name === "tenantId");
    const authorization = parameters.find((parameter: any) => parameter.name === "Authorization");

    expect(tenantId.deprecated).toBe(true);
    expect(tenantId["x-ulfy-status"]).toBe("legacy");
    expect(tenantId.description).toContain("ALLOW_LEGACY_TEMPLATE_TENANT_QUERY=true");
    expect(authorization.deprecated).toBeUndefined();
  });
});
