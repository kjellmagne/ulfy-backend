import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { HttpException, UnauthorizedException } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import * as bcrypt from "bcryptjs";
import { AuthService } from "../src/auth/auth.service";

describe("AuthService", () => {
  let prisma: any;
  let service: AuthService;

  beforeEach(() => {
    vi.stubEnv("DATABASE_URL", "postgresql://test:test@localhost:5432/test?schema=public");
    vi.stubEnv("JWT_SECRET", "j".repeat(64));
    vi.stubEnv("ACTIVATION_TOKEN_SECRET", "a".repeat(64));
    vi.stubEnv("CONFIG_SECRET_KEY", Buffer.alloc(32, 13).toString("base64"));
    vi.stubEnv("LOGIN_MAX_FAILURES", "2");
    vi.stubEnv("LOGIN_LOCKOUT_MINUTES", "15");

    prisma = {
      adminUser: {
        findUnique: vi.fn(),
        update: vi.fn()
      }
    };
    service = new AuthService(prisma, new JwtService());
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("locks an account after the configured number of failed logins", async () => {
    prisma.adminUser.findUnique.mockResolvedValue({
      id: "admin-1",
      email: "admin@example.com",
      passwordHash: await bcrypt.hash("CorrectHorseBatteryStaple!", 4),
      failedLoginCount: 1,
      lockedUntil: null
    });
    prisma.adminUser.update.mockResolvedValue({});

    await expect(service.login("admin@example.com", "wrong-password")).rejects.toBeInstanceOf(UnauthorizedException);

    expect(prisma.adminUser.update).toHaveBeenCalledWith({
      where: { id: "admin-1" },
      data: {
        failedLoginCount: 2,
        lockedUntil: expect.any(Date)
      }
    });
  });

  it("rejects login for a currently locked account", async () => {
    prisma.adminUser.findUnique.mockResolvedValue({
      id: "admin-1",
      email: "admin@example.com",
      passwordHash: await bcrypt.hash("CorrectHorseBatteryStaple!", 4),
      failedLoginCount: 2,
      lockedUntil: new Date(Date.now() + 60_000)
    });

    await expect(service.login("admin@example.com", "CorrectHorseBatteryStaple!")).rejects.toMatchObject<HttpException>({
      message: "Too many login attempts. Try again later.",
      status: 429
    });
    expect(prisma.adminUser.update).not.toHaveBeenCalled();
  });

  it("resets failure counters and issues a versioned admin token on success", async () => {
    prisma.adminUser.findUnique.mockResolvedValue({
      id: "admin-1",
      email: "admin@example.com",
      fullName: "Admin User",
      role: "superadmin",
      partnerId: "partner-1",
      tokenVersion: 3,
      passwordHash: await bcrypt.hash("CorrectHorseBatteryStaple!", 4),
      failedLoginCount: 1,
      lockedUntil: null
    });
    prisma.adminUser.update.mockResolvedValue({
      id: "admin-1",
      email: "admin@example.com",
      fullName: "Admin User",
      role: "superadmin",
      partnerId: "partner-1",
      tokenVersion: 3
    });

    const result = await service.login("ADMIN@example.com", "CorrectHorseBatteryStaple!");
    const claims = await new JwtService().verifyAsync(result.accessToken, {
      secret: "j".repeat(64),
      issuer: "skrivdet-api",
      audience: "skrivdet-admin"
    });

    expect(prisma.adminUser.update).toHaveBeenCalledWith({
      where: { id: "admin-1" },
      data: {
        failedLoginCount: 0,
        lockedUntil: null,
        lastLoginAt: expect.any(Date)
      }
    });
    expect(claims).toMatchObject({
      sub: "admin-1",
      email: "admin@example.com",
      role: "superadmin",
      partnerId: "partner-1",
      version: 3
    });
  });
});
