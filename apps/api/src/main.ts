import "reflect-metadata";
import helmet from "helmet";
import { NestFactory } from "@nestjs/core";
import { ValidationPipe } from "@nestjs/common";
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";
import { AppModule } from "./app.module";

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.setGlobalPrefix("api/v1");
  app.enableCors({ origin: true, credentials: true });
  app.use(helmet());
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));

  const config = new DocumentBuilder()
    .setTitle("Ulfy Backend API")
    .setDescription("Internal/admin-controlled backend for Ulfy licensing, enterprise config and templates. Mobile app activation endpoints are public; admin endpoints require a bearer token from /auth/login. Public deployment path through APISIX is /backend/api/v1.")
    .setVersion("1.0")
    .addServer("https://kvasetech.com/backend", "Kvasetech production through APISIX")
    .addServer("http://localhost:4000", "Local development")
    .addBearerAuth()
    .build();
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup("api/docs", app, document, {
    customSiteTitle: "Ulfy API Docs",
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
