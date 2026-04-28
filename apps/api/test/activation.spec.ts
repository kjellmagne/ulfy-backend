import { beforeEach, describe, expect, it, vi } from "vitest";
import { JwtService } from "@nestjs/jwt";
import { ActivationService } from "../src/activation/activation.service";
import { sha256 } from "../src/common/crypto";

describe("ActivationService", () => {
  let prisma: any;
  let service: ActivationService;

  beforeEach(() => {
    prisma = {
      singleLicenseKey: {
        findUnique: vi.fn(),
        update: vi.fn()
      },
      enterpriseLicenseKey: { findUnique: vi.fn() },
      deviceActivation: {
        upsert: vi.fn(),
        findUnique: vi.fn(),
        update: vi.fn()
      }
    };
    service = new ActivationService(prisma, { log: vi.fn() } as any, new JwtService());
  });

  it("binds a single license to the first device", async () => {
    prisma.singleLicenseKey.findUnique.mockResolvedValue({ id: "key-1", status: "active", expiresAt: null, deviceIdentifier: null, activatedAt: null });
    prisma.deviceActivation.upsert.mockResolvedValue({ id: "act-1" });
    prisma.singleLicenseKey.update.mockResolvedValue({});

    const result = await service.activateSingle({ activationKey: "ULFY-S-ABC", deviceIdentifier: "iphone-1", appVersion: "1.0" });

    expect(result.success).toBe(true);
    expect(result.activationToken).toBeTruthy();
    expect(prisma.singleLicenseKey.findUnique).toHaveBeenCalledWith({ where: { keyHash: sha256("ULFY-S-ABC") } });
    expect(prisma.singleLicenseKey.update.mock.calls[0][0].data.deviceIdentifier).toBe("iphone-1");
  });

  it("rejects a second device for a single license", async () => {
    prisma.singleLicenseKey.findUnique.mockResolvedValue({ id: "key-1", status: "active", expiresAt: null, deviceIdentifier: "iphone-1" });
    await expect(service.activateSingle({ activationKey: "ULFY-S-ABC", deviceIdentifier: "iphone-2", appVersion: "1.0" })).rejects.toThrow();
  });
});
