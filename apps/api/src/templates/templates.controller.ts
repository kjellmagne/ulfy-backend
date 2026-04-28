import { Controller, Get, Header, Param, Query } from "@nestjs/common";
import { ApiOkResponse, ApiOperation, ApiParam, ApiProduces, ApiQuery, ApiTags } from "@nestjs/swagger";
import { TemplatesService } from "./templates.service";

@ApiTags("Templates")
@Controller("templates")
export class TemplatesController {
  constructor(private readonly templates: TemplatesService) {}

  @Get("manifest")
  @ApiOperation({ summary: "Template manifest", description: "Lists published global templates and, when tenantId is supplied, tenant-specific templates for app consumption." })
  @ApiQuery({ name: "tenantId", required: false, description: "Optional tenant UUID for tenant-specific templates." })
  @ApiOkResponse({
    description: "Published template manifest.",
    schema: {
      example: {
        name: "Enterprise Templates",
        templates: [
          {
            id: "00000000-0000-0000-0000-000000000201",
            title: "Personlig diktat / logg",
            short_description: "Kort beskrivelse",
            category: "personlig_diktat",
            language: "nb-NO",
            version: "1.0.0",
            icon: "waveform.and.mic",
            tags: ["dictation", "personal"],
            download_url: "/api/v1/templates/00000000-0000-0000-0000-000000000201/download",
            updated_at: "2026-04-28T12:00:00.000Z"
          }
        ]
      }
    }
  })
  manifest(@Query("tenantId") tenantId?: string) {
    return this.templates.manifest(tenantId);
  }

  @Get(":id/download")
  @Header("Content-Type", "application/x-yaml; charset=utf-8")
  @ApiOperation({ summary: "Download published template YAML", description: "Downloads the currently published YAML content for a template." })
  @ApiParam({ name: "id", description: "Template UUID." })
  @ApiProduces("application/x-yaml")
  @ApiOkResponse({ description: "Raw YAML template.", content: { "application/x-yaml": { schema: { type: "string", example: "title: Personlig diktat / logg\nlanguage: nb-NO\nsections:\n  - id: context\n    title: Kontekst\n    prompt: Oppsummer relevant kontekst kort.\n" } } } })
  async download(@Param("id") id: string) {
    return this.templates.downloadYaml(id);
  }
}
