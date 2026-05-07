import { randomUUID } from "crypto";
import { UnauthorizedException } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { z } from "zod";
import { appEnvironment } from "../config/environment";

export const ACTIVATION_TOKEN_ISSUER = "skrivdet-api";
export const ACTIVATION_TOKEN_AUDIENCE = "skrivdet-mobile";

const ActivationTokenClaimsSchema = z.object({
  kind: z.enum(["single", "enterprise"]),
  licenseId: z.string().min(1),
  deviceIdentifier: z.string().min(1),
  sub: z.string().optional(),
  jti: z.string().optional(),
  nonce: z.string().optional()
});

export type ActivationTokenClaims = z.infer<typeof ActivationTokenClaimsSchema>;

export async function issueActivationToken(jwt: JwtService, input: {
  kind: "single" | "enterprise";
  licenseId: string;
  deviceIdentifier: string;
}) {
  const env = appEnvironment();
  return jwt.signAsync(
    {
      sub: input.licenseId,
      kind: input.kind,
      licenseId: input.licenseId,
      deviceIdentifier: input.deviceIdentifier,
      jti: randomUUID()
    },
    {
      secret: env.ACTIVATION_TOKEN_SECRET,
      expiresIn: env.ACTIVATION_TOKEN_TTL_HOURS * 60 * 60,
      issuer: ACTIVATION_TOKEN_ISSUER,
      audience: ACTIVATION_TOKEN_AUDIENCE
    }
  );
}

export async function verifyActivationToken(jwt: JwtService, token: string) {
  const env = appEnvironment();

  try {
    const claims = await jwt.verifyAsync(token, {
      secret: env.ACTIVATION_TOKEN_SECRET,
      issuer: ACTIVATION_TOKEN_ISSUER,
      audience: ACTIVATION_TOKEN_AUDIENCE
    });
    return ActivationTokenClaimsSchema.parse(claims);
  } catch {
    throw new UnauthorizedException("Invalid activation token");
  }
}
