import { Module } from "@nestjs/common";
import { TemplatesController } from "./templates.controller";
import { TemplatesService } from "./templates.service";
import { AuditService } from "../common/audit.service";

@Module({
  controllers: [TemplatesController],
  providers: [TemplatesService, AuditService],
  exports: [TemplatesService]
})
export class TemplatesModule {}
