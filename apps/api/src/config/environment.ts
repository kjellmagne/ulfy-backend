import { z } from "zod";

const defaultCorsAllowedOrigins = [
  "http://localhost:3000",
  "http://127.0.0.1:3000",
  "http://localhost:3001",
  "http://127.0.0.1:3001",
  "https://skrivdet.no",
  "https://www.skrivdet.no"
].join(",");

const trimmedOptionalString = z.preprocess((value) => {
  if (typeof value !== "string") return value;
  const trimmed = value.trim();
  return trimmed.length ? trimmed : undefined;
}, z.string().optional());

const booleanWithDefault = (defaultValue: boolean) => z.preprocess((value) => {
  if (value === undefined || value === null || value === "") return defaultValue;
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value !== 0;
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if (["true", "1", "yes", "on"].includes(normalized)) return true;
    if (["false", "0", "no", "off"].includes(normalized)) return false;
  }
  return value;
}, z.boolean());

const integerWithDefault = (defaultValue: number, minimum: number, maximum: number) => z.preprocess((value) => {
  if (value === undefined || value === null || value === "") return defaultValue;
  if (typeof value === "number") return value;
  if (typeof value === "string") return Number(value);
  return value;
}, z.number().int().min(minimum).max(maximum));

const EnvironmentSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: integerWithDefault(4000, 1, 65535),
  DATABASE_URL: z.string().trim().min(1, "DATABASE_URL is required"),
  JWT_SECRET: z.string().trim().min(32, "JWT_SECRET must be at least 32 characters"),
  JWT_EXPIRES_IN_HOURS: integerWithDefault(12, 1, 168),
  LOGIN_MAX_FAILURES: integerWithDefault(5, 1, 20),
  LOGIN_LOCKOUT_MINUTES: integerWithDefault(15, 1, 1440),
  ACTIVATION_TOKEN_SECRET: z.string().trim().min(32, "ACTIVATION_TOKEN_SECRET must be at least 32 characters"),
  ACTIVATION_TOKEN_TTL_HOURS: integerWithDefault(720, 24, 2160),
  TEMPLATE_REPOSITORY_API_KEY: trimmedOptionalString,
  CONFIG_SECRET_KEY: z.string().trim().min(32, "CONFIG_SECRET_KEY is required"),
  CORS_ALLOWED_ORIGINS: z.string().default(defaultCorsAllowedOrigins),
  SWAGGER_ENABLED: booleanWithDefault(true),
  SWAGGER_BASIC_AUTH_USERNAME: trimmedOptionalString,
  SWAGGER_BASIC_AUTH_PASSWORD: trimmedOptionalString
}).superRefine((env, context) => {
  if (!decodeSecretKey(env.CONFIG_SECRET_KEY)) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["CONFIG_SECRET_KEY"],
      message: "CONFIG_SECRET_KEY must decode to a 32-byte AES key (hex, base64, or base64url)."
    });
  }
  if (env.SWAGGER_ENABLED && env.NODE_ENV === "production") {
    if (!env.SWAGGER_BASIC_AUTH_USERNAME) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["SWAGGER_BASIC_AUTH_USERNAME"],
        message: "SWAGGER_BASIC_AUTH_USERNAME is required when Swagger is enabled in production."
      });
    }
    if (!env.SWAGGER_BASIC_AUTH_PASSWORD) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["SWAGGER_BASIC_AUTH_PASSWORD"],
        message: "SWAGGER_BASIC_AUTH_PASSWORD is required when Swagger is enabled in production."
      });
    }
  }
});

export type AppEnvironment = z.infer<typeof EnvironmentSchema>;

export function validateEnvironment(raw: Record<string, unknown>) {
  return EnvironmentSchema.parse(raw);
}

export function appEnvironment() {
  return validateEnvironment(process.env);
}

export function corsAllowedOrigins(env: AppEnvironment = appEnvironment()) {
  return env.CORS_ALLOWED_ORIGINS
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
}

export function configSecretKeyBytes(env: AppEnvironment = appEnvironment()) {
  const decoded = decodeSecretKey(env.CONFIG_SECRET_KEY);
  if (!decoded) {
    throw new Error("CONFIG_SECRET_KEY is not a valid 32-byte encryption key.");
  }
  return decoded;
}

function decodeSecretKey(value: string) {
  const trimmed = value.trim();
  if (/^[0-9a-f]{64}$/i.test(trimmed)) {
    return Buffer.from(trimmed, "hex");
  }

  for (const encoding of ["base64", "base64url"] as const) {
    try {
      const buffer = Buffer.from(trimmed, encoding);
      if (buffer.length === 32) return buffer;
    } catch {
      // Try the next supported encoding.
    }
  }

  return null;
}
