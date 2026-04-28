import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";

@Injectable()
export class AdminGuard implements CanActivate {
  constructor(private readonly jwt: JwtService) {}

  async canActivate(context: ExecutionContext) {
    const req = context.switchToHttp().getRequest();
    const header = req.headers.authorization ?? "";
    const token = header.startsWith("Bearer ") ? header.slice(7) : undefined;
    if (!token) throw new UnauthorizedException("Missing bearer token");
    try {
      req.user = await this.jwt.verifyAsync(token, { secret: process.env.JWT_SECRET ?? "dev-secret" });
      return true;
    } catch {
      throw new UnauthorizedException("Invalid bearer token");
    }
  }
}
