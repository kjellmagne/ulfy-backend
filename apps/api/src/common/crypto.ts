import { createHash, randomBytes } from "crypto";

export function sha256(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

export type ActivationKeyPrefix = "SKRIVDET-S" | "SKRIVDET-E" | "ULFY-S" | "ULFY-E";

export function createActivationKey(prefix: ActivationKeyPrefix) {
  const body = randomBytes(18).toString("base64url").toUpperCase();
  return `${prefix}-${body.slice(0, 6)}-${body.slice(6, 12)}-${body.slice(12, 18)}-${body.slice(18, 24)}`;
}

export function activationKeyPrefix(activationKey: string) {
  return activationKey.split("-").slice(0, 3).join("-");
}

export function tokenHash(value: string) {
  return sha256(value);
}
