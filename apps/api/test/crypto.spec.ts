import { describe, expect, it } from "vitest";
import { activationKeyPrefix, createActivationKey } from "../src/common/crypto";

describe("activation key branding", () => {
  it("generates new skrivDET-prefixed keys while preserving prefix display for legacy keys", () => {
    const singleKey = createActivationKey("SKRIVDET-S");
    const enterpriseKey = createActivationKey("SKRIVDET-E");

    expect(singleKey).toMatch(/^SKRIVDET-S-[A-Z0-9_-]{6}-[A-Z0-9_-]{6}-[A-Z0-9_-]{6}-[A-Z0-9_-]{6}$/);
    expect(enterpriseKey).toMatch(/^SKRIVDET-E-[A-Z0-9_-]{6}-[A-Z0-9_-]{6}-[A-Z0-9_-]{6}-[A-Z0-9_-]{6}$/);
    expect(activationKeyPrefix(singleKey)).toMatch(/^SKRIVDET-S-[A-Z0-9_-]{6}$/);
    expect(activationKeyPrefix("SKRIVDET-S-HF-ABC-DEF456-GHI789-JKL012")).toBe("SKRIVDET-S-HF-ABC");
    expect(activationKeyPrefix("ULFY-S-ABC123-DEF456-GHI789-JKL012")).toBe("ULFY-S-ABC123");
  });
});
