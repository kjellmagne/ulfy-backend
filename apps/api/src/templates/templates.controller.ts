import { Controller, Get, Header, Headers, Param, UnauthorizedException, UseFilters } from "@nestjs/common";
import { Throttle } from "@nestjs/throttler";
import { ApiBearerAuth, ApiHeader, ApiOkResponse, ApiOperation, ApiParam, ApiProduces, ApiTags, ApiUnauthorizedResponse } from "@nestjs/swagger";
import { TemplatesService } from "./templates.service";
import { MobileExceptionFilter } from "../activation/mobile-exception.filter";
import { mobileError } from "../activation/activation.service";

const templateManifestExample = {
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
};

const templateManifestSchema = {
  type: "object",
  required: ["name", "templates"],
  properties: {
    name: { type: "string", description: "Display name for the catalog returned to the app." },
    templates: {
      type: "array",
      description: "Latest published, tenant-entitled template variants. Drafts and old versions are not included.",
      items: {
        type: "object",
        required: ["id", "title", "short_description", "category", "language", "version", "icon", "tags", "download_url", "updated_at"],
        properties: {
          id: { type: "string", format: "uuid", description: "Template identity UUID from the YAML identity.id. Use this id for download and installed-template update matching." },
          title: { type: "string", description: "Localized template title." },
          short_description: { type: "string", description: "Short localized description for catalog display." },
          category: { type: "string", description: "Template category slug/name from YAML identity.category." },
          language: { type: "string", example: "nb-NO", description: "BCP-47 language code for this YAML variant. Each variant is one language." },
          version: { type: "string", example: "1.0.0", description: "Semantic version of the latest published immutable YAML snapshot." },
          icon: { type: "string", example: "waveform.and.mic", description: "SF Symbol name stored in the template YAML. Web admin may render an approximate mapped icon." },
          tags: { type: "array", items: { type: "string" }, description: "Template tag names/slugs for filtering and display." },
          download_url: { type: "string", description: "Relative API URL for raw YAML download. Resolve against the backend API base and send the same bearer activation token." },
          updated_at: { type: "string", format: "date-time", description: "Published timestamp of the returned version." }
        }
      }
    }
  },
  example: templateManifestExample
};

const mobileUnauthorizedSchema = {
  type: "object",
  required: ["success", "error"],
  properties: {
    success: { type: "boolean", enum: [false] },
    error: {
      type: "object",
      required: ["code", "message"],
      properties: {
        code: { type: "string", example: "activation_token_required" },
        message: { type: "string", example: "Template repository access requires an enterprise activation token" }
      }
    }
  }
};

@ApiTags("Templates")
@UseFilters(MobileExceptionFilter)
@Controller("templates")
export class TemplatesController {
  constructor(private readonly templates: TemplatesService) {}

  @Get("manifest")
  @Throttle({ default: { limit: 60, ttl: 60_000 } })
  @ApiBearerAuth()
  @ApiOperation({
    summary: "Tenant-filtered template manifest",
    description: [
      "Lists latest published template variants available to the enterprise activation token.",
      "Normal mobile access uses Authorization: Bearer <activationToken>; single-user activations do not receive central repository access.",
      "The backend filters by tenant template-family entitlement and returns only the latest published version per language variant.",
      "Internal verification can use Authorization: Bearer <TEMPLATE_REPOSITORY_API_KEY> when that override key is explicitly configured."
    ].join(" ")
  })
  @ApiHeader({ name: "Authorization", required: true, description: "Bearer enterprise activation token, or TEMPLATE_REPOSITORY_API_KEY for internal verification." })
  @ApiOkResponse({ description: "Published template manifest filtered by tenant entitlement.", schema: templateManifestSchema })
  @ApiUnauthorizedResponse({ description: "Missing or invalid enterprise activation token.", schema: mobileUnauthorizedSchema })
  manifest(@Headers("authorization") authorization?: string) {
    const bearer = this.bearerToken(authorization);
    if (bearer) return this.templates.manifestForScopedBearer(bearer);
    throw new UnauthorizedException(mobileError("activation_token_required", "Template repository access requires an enterprise activation token"));
  }

  @Get(":id/download")
  @Throttle({ default: { limit: 60, ttl: 60_000 } })
  @Header("Content-Type", "application/x-yaml; charset=utf-8")
  @ApiBearerAuth()
  @ApiOperation({
    summary: "Download tenant-entitled published template YAML",
    description: [
      "Downloads the latest published immutable YAML snapshot for a template identity UUID.",
      "The same Authorization bearer activation token used for the manifest must be sent here.",
      "The YAML schema is the app's source-of-truth template format: identity, context, perspective, structure, content_rules and llm_prompting."
    ].join(" ")
  })
  @ApiParam({ name: "id", description: "Template identity UUID from the manifest." })
  @ApiHeader({ name: "Authorization", required: true, description: "Bearer enterprise activation token, or TEMPLATE_REPOSITORY_API_KEY for internal verification." })
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
  @ApiUnauthorizedResponse({ description: "Missing or invalid enterprise activation token, or tenant is not entitled to the template family.", schema: mobileUnauthorizedSchema })
  async download(@Param("id") id: string, @Headers("authorization") authorization?: string) {
    const bearer = this.bearerToken(authorization);
    if (bearer) return this.templates.downloadYamlForScopedBearer(id, bearer);
    throw new UnauthorizedException(mobileError("activation_token_required", "Template download requires an enterprise activation token"));
  }

  private bearerToken(authorization?: string) {
    return authorization?.startsWith("Bearer ") ? authorization.slice(7).trim() : "";
  }
}
