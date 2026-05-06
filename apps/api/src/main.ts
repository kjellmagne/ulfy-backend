import "reflect-metadata";
import helmet from "helmet";
import { NestFactory } from "@nestjs/core";
import { ValidationPipe } from "@nestjs/common";
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";
import { AppModule } from "./app.module";
import { enrichOpenApiDescriptions } from "./openapi/descriptions";

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.setGlobalPrefix("api/v1");
  app.enableCors({ origin: true, credentials: true });
  app.use(helmet());
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));

  const config = new DocumentBuilder()
    .setTitle("skrivDET Backend API")
    .setDescription([
      "Internal/admin-controlled backend for skrivDET licensing, enterprise config and templates.",
      "Mobile activation endpoints return a consistent { success, error: { code, message } } shape for errors.",
      "Enterprise config is sparse: omitted config fields mean the iOS app should keep local settings, while present fields are intentional managed policy.",
      "Admin endpoints require a bearer token from /auth/login.",
      "Public deployment path through APISIX is /skrivdet/api/v1; Swagger UI is available at /skrivdet/api/docs and raw OpenAPI JSON at /skrivdet/api/docs-json."
    ].join(" "))
    .setVersion("1.0")
    .addServer("https://kvasetech.com/skrivdet", "Kvasetech production through APISIX")
    .addServer("http://localhost:4000", "Local development")
    .addBearerAuth()
    .build();
  const document = enrichOpenApiDescriptions(SwaggerModule.createDocument(app, config));
  SwaggerModule.setup("api/docs", app, document, {
    customSiteTitle: "skrivDET API Docs",
    jsonDocumentUrl: "api/docs-json",
    swaggerOptions: {
      persistAuthorization: true,
      tagsSorter: "alpha",
      operationsSorter: "alpha"
    }
  });

  await app.listen(process.env.PORT ? Number(process.env.PORT) : 4000);
}

bootstrap();
