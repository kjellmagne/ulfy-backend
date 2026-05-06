import { Controller, Get } from "@nestjs/common";
import { ApiOkResponse, ApiOperation, ApiTags } from "@nestjs/swagger";
import { PrismaService } from "../prisma/prisma.service";

@ApiTags("System")
@Controller("health")
export class HealthController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  @ApiOperation({ summary: "Health check", description: "Checks that the API process is alive and can query PostgreSQL." })
  @ApiOkResponse({ description: "API and database are healthy.", schema: { example: { ok: true, service: "skrivdet-api", timestamp: "2026-04-28T19:30:53.566Z" } } })
  async health() {
    await this.prisma.$queryRaw`SELECT 1`;
    return { ok: true, service: "skrivdet-api", timestamp: new Date().toISOString() };
  }
}
