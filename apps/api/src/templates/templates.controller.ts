import { Controller, Get, Header, Param, Query } from "@nestjs/common";
import { TemplatesService } from "./templates.service";

@Controller("templates")
export class TemplatesController {
  constructor(private readonly templates: TemplatesService) {}

  @Get("manifest")
  manifest(@Query("tenantId") tenantId?: string) {
    return this.templates.manifest(tenantId);
  }

  @Get(":id/download")
  @Header("Content-Type", "application/x-yaml; charset=utf-8")
  async download(@Param("id") id: string) {
    return this.templates.downloadYaml(id);
  }
}
