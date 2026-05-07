import { HttpException, HttpStatus, Injectable, UnauthorizedException } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import * as bcrypt from "bcryptjs";
import { PrismaService } from "../prisma/prisma.service";
import { appEnvironment } from "../config/environment";

const ADMIN_JWT_ISSUER = "skrivdet-api";
const ADMIN_JWT_AUDIENCE = "skrivdet-admin";

@Injectable()
export class AuthService {
  constructor(private readonly prisma: PrismaService, private readonly jwt: JwtService) {}

  async login(email: string, password: string) {
    const env = appEnvironment();
    const normalizedEmail = email.toLowerCase();
    const user = await this.prisma.adminUser.findUnique({ where: { email: normalizedEmail } });
    if (user?.lockedUntil && user.lockedUntil.getTime() > Date.now()) {
      throw new HttpException("Too many login attempts. Try again later.", HttpStatus.TOO_MANY_REQUESTS);
    }

    if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
      if (user) {
        const failedLoginCount = (user.failedLoginCount ?? 0) + 1;
        await this.prisma.adminUser.update({
          where: { id: user.id },
          data: {
            failedLoginCount,
            lockedUntil: failedLoginCount >= env.LOGIN_MAX_FAILURES
              ? new Date(Date.now() + env.LOGIN_LOCKOUT_MINUTES * 60_000)
              : null
          }
        });
      }
      throw new UnauthorizedException("Invalid email or password");
    }

    const updatedUser = await this.prisma.adminUser.update({
      where: { id: user.id },
      data: {
        failedLoginCount: 0,
        lockedUntil: null,
        lastLoginAt: new Date()
      }
    });

    const accessToken = await this.jwt.signAsync(
      {
        sub: updatedUser.id,
        email: updatedUser.email,
        role: updatedUser.role,
        partnerId: updatedUser.partnerId,
        version: updatedUser.tokenVersion ?? 0
      },
      {
        secret: env.JWT_SECRET,
        expiresIn: env.JWT_EXPIRES_IN_HOURS * 60 * 60,
        issuer: ADMIN_JWT_ISSUER,
        audience: ADMIN_JWT_AUDIENCE
      }
    );
    return {
      accessToken,
      user: {
        id: updatedUser.id,
        email: updatedUser.email,
        fullName: updatedUser.fullName,
        role: updatedUser.role,
        partnerId: updatedUser.partnerId
      }
    };
  }
}
