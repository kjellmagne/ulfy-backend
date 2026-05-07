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
      "Canonical public API base through APISIX is https://api.skrivdet.no/api/v1; the admin gateway keeps /backend/api/v1 as a same-origin compatibility path."
    ].join(" "))
    .setVersion("1.0")
    .addServer("https://api.skrivdet.no", "skrivDET production API")
    .addServer("https://skrivdet.no/backend", "skrivDET admin same-origin compatibility path")
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
