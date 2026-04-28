import { createHash, randomBytes } from "crypto";

export function sha256(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

export function createActivationKey(prefix: "ULFY-S" | "ULFY-E") {
  const body = randomBytes(18).toString("base64url").toUpperCase();
  return `${prefix}-${body.slice(0, 6)}-${body.slice(6, 12)}-${body.slice(12, 18)}-${body.slice(18, 24)}`;
}

export function tokenHash(value: string) {
  return sha256(value);
}
