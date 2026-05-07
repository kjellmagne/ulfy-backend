import { Module } from "@nestjs/common";
import { TemplatesController } from "./templates.controller";
import { TemplatesService } from "./templates.service";
import { AuditService } from "../common/audit.service";
import { AuthModule } from "../auth/auth.module";

@Module({
  imports: [AuthModule],
  controllers: [TemplatesController],
  providers: [TemplatesService, AuditService],
  exports: [TemplatesService]
})
export class TemplatesModule {}
