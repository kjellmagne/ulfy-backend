import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import * as yaml from "js-yaml";
import { TemplateYamlSchema } from "@ulfy/contracts";
import { PrismaService } from "../prisma/prisma.service";
import { AuditService } from "../common/audit.service";

@Injectable()
export class TemplatesService {
  constructor(private readonly prisma: PrismaService, private readonly audit: AuditService) {}

  async manifest(tenantId?: string) {
    const templates = await this.prisma.template.findMany({
      where: {
        state: "published",
        OR: [{ tenantId: null }, ...(tenantId ? [{ tenantId }] : [])]
      },
      include: { category: true, versions: true },
      orderBy: [{ updatedAt: "desc" }]
    });

    return {
      name: tenantId ? "Enterprise Templates" : "Ulfy Templates",
      templates: templates
        .map((template) => {
          const version = template.versions.find((item) => item.id === template.publishedVersionId) ?? template.versions.find((item) => item.state === "published");
          if (!version) return null;
          return {
            id: template.id,
            title: template.title,
            short_description: template.shortDescription,
            category: template.category?.slug ?? "general",
            language: template.language,
            version: version.version,
            icon: template.icon,
            tags: template.tags,
            download_url: `/api/v1/templates/${template.id}/download`,
            updated_at: template.updatedAt.toISOString()
          };
        })
        .filter(Boolean)
    };
  }

  async downloadYaml(id: string) {
    const template = await this.prisma.template.findUnique({ where: { id }, include: { versions: true } });
    if (!template || template.state !== "published") throw new NotFoundException("Template not found");
    const version = template.versions.find((item) => item.id === template.publishedVersionId) ?? template.versions.find((item) => item.state === "published");
    if (!version) throw new NotFoundException("Published template version not found");
    return version.yamlContent;
  }

  validateYamlContent(yamlContent: string) {
    let parsed: unknown;
    try {
      parsed = yaml.load(yamlContent);
    } catch (error) {
      throw new BadRequestException(`Invalid YAML: ${(error as Error).message}`);
    }
    const result = TemplateYamlSchema.safeParse(parsed);
    if (!result.success) throw new BadRequestException({ message: "Template schema validation failed", issues: result.error.issues });
    return result.data;
  }

  async publish(templateId: string, versionId: string, actor?: { id?: string; email?: string }) {
    const version = await this.prisma.templateVersion.findFirst({ where: { id: versionId, templateId } });
    if (!version) throw new NotFoundException("Template version not found");
    this.validateYamlContent(version.yamlContent);

    await this.prisma.$transaction([
      this.prisma.templateVersion.updateMany({ where: { templateId }, data: { state: "draft", publishedAt: null } }),
      this.prisma.templateVersion.update({ where: { id: versionId }, data: { state: "published", publishedAt: new Date() } }),
      this.prisma.template.update({ where: { id: templateId }, data: { state: "published", publishedVersionId: versionId } })
    ]);
    await this.audit.log({ actorAdminId: actor?.id, actorEmail: actor?.email, action: "template.publish", targetType: "Template", targetId: templateId, metadata: { versionId } });
    return { success: true };
  }
}
