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
    prisma.deviceActivation.upsert.mockResolvedValue({
      id: "act-1",
      deviceIdentifier: "iphone-1",
      deviceSerialNumber: "SERIAL-1",
      lastSeenAt: new Date("2026-04-29T08:00:00.000Z")
    });
    prisma.singleLicenseKey.update.mockResolvedValue({});

    const result = await service.activateSingle({ activationKey: "ULFY-S-ABC", deviceIdentifier: "iphone-1", deviceSerialNumber: "SERIAL-1", appVersion: "1.0" });

    expect(result.success).toBe(true);
    expect(result.activationToken).toBeTruthy();
    expect(result.device).toEqual({
      deviceIdentifier: "iphone-1",
      deviceSerialNumber: "SERIAL-1",
      lastSeenAt: "2026-04-29T08:00:00.000Z"
    });
    expect(prisma.singleLicenseKey.findUnique).toHaveBeenCalledWith({ where: { keyHash: sha256("ULFY-S-ABC") } });
    expect(prisma.singleLicenseKey.update.mock.calls[0][0].data.deviceIdentifier).toBe("iphone-1");
    expect(prisma.singleLicenseKey.update.mock.calls[0][0].data.deviceSerialNumber).toBe("SERIAL-1");
    expect(prisma.singleLicenseKey.update.mock.calls[0][0].data.lastSeenAt).toBeInstanceOf(Date);
  });

  it("rejects a second device for a single license", async () => {
    prisma.singleLicenseKey.findUnique.mockResolvedValue({ id: "key-1", status: "active", expiresAt: null, deviceIdentifier: "iphone-1" });
    await expect(service.activateSingle({ activationKey: "ULFY-S-ABC", deviceIdentifier: "iphone-2", appVersion: "1.0" })).rejects.toThrow();
  });

  it("updates last seen and serial number on refresh", async () => {
    prisma.deviceActivation.findUnique.mockResolvedValue({
      id: "act-1",
      kind: "single",
      status: "active",
      deviceIdentifier: "iphone-1",
      deviceSerialNumber: null,
      appVersion: "1.0",
      singleLicenseKeyId: "key-1",
      enterpriseLicenseKey: null
    });
    prisma.deviceActivation.update.mockResolvedValue({});
    prisma.singleLicenseKey.update.mockResolvedValue({});

    const result = await service.refresh({ activationToken: "token-token-token-token", deviceIdentifier: "iphone-1", deviceSerialNumber: "SERIAL-1", appVersion: "1.1" });

    expect(result.success).toBe(true);
    expect(result.device.deviceSerialNumber).toBe("SERIAL-1");
    expect(result.lastSeenAt).toBeTruthy();
    expect(prisma.deviceActivation.update.mock.calls[0][0].data.lastSeenAt).toBeInstanceOf(Date);
    expect(prisma.singleLicenseKey.update.mock.calls[0][0].data.lastSeenAt).toBeInstanceOf(Date);
  });
});
