import { Injectable, UnauthorizedException } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import * as bcrypt from "bcryptjs";
import { PrismaService } from "../prisma/prisma.service";

@Injectable()
export class AuthService {
  constructor(private readonly prisma: PrismaService, private readonly jwt: JwtService) {}

  async login(email: string, password: string) {
    const user = await this.prisma.adminUser.findUnique({ where: { email: email.toLowerCase() } });
    if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
      throw new UnauthorizedException("Invalid email or password");
    }

    const accessToken = await this.jwt.signAsync(
      { sub: user.id, email: user.email, role: user.role, partnerId: user.partnerId },
      { secret: process.env.JWT_SECRET ?? "dev-secret", expiresIn: "12h" }
    );
    return {
      accessToken,
      user: { id: user.id, email: user.email, fullName: user.fullName, role: user.role, partnerId: user.partnerId }
    };
  }
}
