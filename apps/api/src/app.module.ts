import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { AuthModule } from "./auth/auth.module";
import { PrismaModule } from "./prisma/prisma.module";
import { ActivationModule } from "./activation/activation.module";
import { TemplatesModule } from "./templates/templates.module";
import { AdminModule } from "./admin/admin.module";
import { HealthModule } from "./health/health.module";

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    AuthModule,
    ActivationModule,
    TemplatesModule,
    AdminModule,
    HealthModule
  ]
})
export class AppModule {}
