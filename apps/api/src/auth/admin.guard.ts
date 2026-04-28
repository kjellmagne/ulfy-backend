import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { PrismaService } from "../prisma/prisma.service";

@Injectable()
export class AdminGuard implements CanActivate {
  constructor(private readonly jwt: JwtService, private readonly prisma: PrismaService) {}

  async canActivate(context: ExecutionContext) {
    const req = context.switchToHttp().getRequest();
    const header = req.headers.authorization ?? "";
    const token = header.startsWith("Bearer ") ? header.slice(7) : undefined;
    if (!token) throw new UnauthorizedException("Missing bearer token");
    try {
      const claims = await this.jwt.verifyAsync(token, { secret: process.env.JWT_SECRET ?? "dev-secret" });
      const user = await this.prisma.adminUser.findUnique({ where: { id: claims.sub } });
      if (!user) throw new UnauthorizedException("Admin user no longer exists");
      req.user = { sub: user.id, email: user.email, role: user.role, partnerId: user.partnerId };
      return true;
    } catch {
      throw new UnauthorizedException("Invalid bearer token");
    }
  }
}
