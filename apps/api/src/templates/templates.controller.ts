import { Controller, Get, Header, Headers, Param, Query, UnauthorizedException, UseFilters } from "@nestjs/common";
import { ApiBearerAuth, ApiHeader, ApiOkResponse, ApiOperation, ApiParam, ApiProduces, ApiQuery, ApiTags } from "@nestjs/swagger";
import { TemplatesService } from "./templates.service";
import { MobileExceptionFilter } from "../activation/mobile-exception.filter";
import { mobileError } from "../activation/activation.service";

@ApiTags("Templates")
@UseFilters(MobileExceptionFilter)
@Controller("templates")
export class TemplatesController {
  constructor(private readonly templates: TemplatesService) {}

  @Get("manifest")
  @ApiBearerAuth()
  @ApiOperation({
    summary: "Tenant-filtered template manifest",
    description: "Lists latest published template variants available to the enterprise activation token. Normal mobile access uses Authorization: Bearer <activationToken>. An internal X-API-Key override can be enabled with TEMPLATE_REPOSITORY_API_KEY."
  })
  @ApiHeader({ name: "Authorization", required: false, description: "Bearer enterprise activation token." })
  @ApiHeader({ name: "X-API-Key", required: false, description: "Internal/developer repository override key." })
  @ApiQuery({ name: "tenantId", required: false, description: "Legacy development-only tenant filter. Do not use for normal enterprise mobile access." })
  @ApiOkResponse({
    description: "Published template manifest filtered by tenant entitlement.",
    schema: {
      example: {
        name: "Enterprise Templates",
        templates: [
          {
            id: "00000000-0000-4000-8000-000000000201",
            title: "Personlig diktat / logg",
            short_description: "Kort beskrivelse",
            category: "personlig_diktat",
            language: "nb-NO",
            version: "1.0.0",
            icon: "waveform.and.mic",
            tags: ["dictation", "personal"],
            download_url: "/api/v1/templates/00000000-0000-4000-8000-000000000201/download",
            updated_at: "2026-04-29T12:00:00.000Z"
          }
        ]
      }
    }
  })
  manifest(@Headers("authorization") authorization?: string, @Headers("x-api-key") apiKey?: string, @Query("tenantId") tenantId?: string) {
    const bearer = this.bearerToken(authorization);
    if (bearer && process.env.TEMPLATE_REPOSITORY_API_KEY && bearer === process.env.TEMPLATE_REPOSITORY_API_KEY) {
      return this.templates.manifestForInternalApiKey(bearer);
    }
    if (apiKey) return this.templates.manifestForInternalApiKey(apiKey);
    if (bearer) return this.templates.manifestForEnterpriseActivation(bearer);
    if (tenantId && process.env.ALLOW_LEGACY_TEMPLATE_TENANT_QUERY === "true") return this.templates.manifest(tenantId);
    throw new UnauthorizedException(mobileError("activation_token_required", "Template repository access requires an enterprise activation token"));
  }

  @Get(":id/download")
  @Header("Content-Type", "application/x-yaml; charset=utf-8")
  @ApiBearerAuth()
  @ApiOperation({
    summary: "Download tenant-entitled published template YAML",
    description: "Downloads the latest published YAML snapshot for a template identity UUID when the activation token's tenant is entitled to the template family."
  })
  @ApiParam({ name: "id", description: "Template identity UUID from the manifest." })
  @ApiHeader({ name: "Authorization", required: false, description: "Bearer enterprise activation token." })
  @ApiHeader({ name: "X-API-Key", required: false, description: "Internal/developer repository override key." })
  @ApiProduces("application/x-yaml")
  @ApiOkResponse({
    description: "Raw YAML template.",
    content: {
      "application/x-yaml": {
        schema: {
          type: "string",
          example: "identity:\n  id: 00000000-0000-4000-8000-000000000201\n  title: Personlig diktat / logg\n  language: nb-NO\n  version: 1.0.0\ncontext:\n  purpose: Create a clear note from the transcript.\n"
        }
      }
    }
  })
  async download(@Param("id") id: string, @Headers("authorization") authorization?: string, @Headers("x-api-key") apiKey?: string) {
    const bearer = this.bearerToken(authorization);
    if (bearer && process.env.TEMPLATE_REPOSITORY_API_KEY && bearer === process.env.TEMPLATE_REPOSITORY_API_KEY) return this.templates.downloadYamlForInternalApiKey(id, bearer);
    if (apiKey) return this.templates.downloadYamlForInternalApiKey(id, apiKey);
    if (bearer) return this.templates.downloadYamlForEnterpriseActivation(id, bearer);
    throw new UnauthorizedException(mobileError("activation_token_required", "Template download requires an enterprise activation token"));
  }

  private bearerToken(authorization?: string) {
    return authorization?.startsWith("Bearer ") ? authorization.slice(7).trim() : "";
  }
}
