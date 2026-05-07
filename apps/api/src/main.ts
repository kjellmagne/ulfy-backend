import "reflect-metadata";
import helmet from "helmet";
import { NestFactory } from "@nestjs/core";
import { ValidationPipe } from "@nestjs/common";
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";
import { AppModule } from "./app.module";
import { enrichOpenApiDescriptions } from "./openapi/descriptions";
import { appEnvironment, corsAllowedOrigins } from "./config/environment";

async function bootstrap() {
  const env = appEnvironment();
  const app = await NestFactory.create(AppModule);
  const express = app.getHttpAdapter().getInstance();
  express.set("trust proxy", 1);
  app.setGlobalPrefix("api/v1");
  const allowedOrigins = new Set(corsAllowedOrigins(env));
  const corsOrigin = (origin: string | undefined, callback: (error: Error | null, allow?: boolean) => void) => {
    if (!origin) return callback(null, true);
    if (allowedOrigins.has(origin)) return callback(null, true);
    return callback(new Error("Origin not allowed by CORS"), false);
  };
  app.enableCors({
    origin: corsOrigin,
    credentials: true,
    methods: ["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Authorization", "Content-Type"]
  });
  app.use(helmet());
  app.useGlobalPipes(new ValidationPipe({
    whitelist: true,
    transform: true,
    forbidNonWhitelisted: true,
    forbidUnknownValues: true,
    stopAtFirstError: true
  }));

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
  if (env.SWAGGER_ENABLED) {
    const swaggerGuard = createSwaggerAuthMiddleware(env.SWAGGER_BASIC_AUTH_USERNAME, env.SWAGGER_BASIC_AUTH_PASSWORD);
    express.use("/api/docs", swaggerGuard);
    express.use("/api/docs-json", swaggerGuard);
    const document = enrichOpenApiDescriptions(SwaggerModule.createDocument(app, config));
    SwaggerModule.setup("api/docs", app, document, {
      customSiteTitle: "skrivDET API Docs",
      jsonDocumentUrl: "api/docs-json",
      swaggerOptions: {
        persistAuthorization: env.NODE_ENV !== "production",
        tagsSorter: "alpha",
        operationsSorter: "alpha"
      }
    });
  }

  await app.listen(env.PORT);
}

bootstrap();

function createSwaggerAuthMiddleware(username?: string, password?: string) {
  if (!username || !password) {
    return (_req: any, _res: any, next: () => void) => next();
  }

  return (req: any, res: any, next: () => void) => {
    const header = typeof req.headers.authorization === "string" ? req.headers.authorization : "";
    const [scheme, encoded] = header.split(" ");

    if (scheme === "Basic" && encoded) {
      const [providedUser, providedPassword] = Buffer.from(encoded, "base64").toString("utf8").split(":");
      if (providedUser === username && providedPassword === password) {
        return next();
      }
    }

    res.setHeader("WWW-Authenticate", 'Basic realm="skrivDET API Docs"');
    res.status(401).send("Swagger authentication required");
  };
}
