import { Module } from "@nestjs/common";
import { AdminController } from "./admin.controller";
import { AuditService } from "../common/audit.service";
import { TemplatesService } from "../templates/templates.service";

@Module({
  controllers: [AdminController],
  providers: [AuditService, TemplatesService]
})
export class AdminModule {}
