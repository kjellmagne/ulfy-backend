import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { PrismaService } from "../prisma/prisma.service";
import { appEnvironment } from "../config/environment";

const ADMIN_JWT_ISSUER = "skrivdet-api";
const ADMIN_JWT_AUDIENCE = "skrivdet-admin";

@Injectable()
export class AdminGuard implements CanActivate {
  constructor(private readonly jwt: JwtService, private readonly prisma: PrismaService) {}

  async canActivate(context: ExecutionContext) {
    const req = context.switchToHttp().getRequest();
    const header = req.headers.authorization ?? "";
    const token = header.startsWith("Bearer ") ? header.slice(7) : undefined;
    if (!token) throw new UnauthorizedException("Missing bearer token");
    try {
      const env = appEnvironment();
      const claims = await this.jwt.verifyAsync(token, {
        secret: env.JWT_SECRET,
        issuer: ADMIN_JWT_ISSUER,
        audience: ADMIN_JWT_AUDIENCE
      });
      const user = await this.prisma.adminUser.findUnique({ where: { id: claims.sub } });
      if (!user) throw new UnauthorizedException("Admin user no longer exists");
      if ((claims.version ?? 0) !== (user.tokenVersion ?? 0)) {
        throw new UnauthorizedException("Admin session has been replaced");
      }
      req.user = { sub: user.id, email: user.email, role: user.role, partnerId: user.partnerId };
      return true;
    } catch {
      throw new UnauthorizedException("Invalid bearer token");
    }
  }
}
