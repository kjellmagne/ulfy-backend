import { ExecutionContext, Injectable } from "@nestjs/common";
import { ThrottlerGuard } from "@nestjs/throttler";

@Injectable()
export class RateLimitGuard extends ThrottlerGuard {
  protected async getTracker(req: Record<string, any>) {
    const forwardedFor = req.headers?.["x-forwarded-for"];
    const forwardedValue = Array.isArray(forwardedFor) ? forwardedFor[0] : forwardedFor;
    const forwardedIp = typeof forwardedValue === "string"
      ? forwardedValue.split(",")[0]?.trim()
      : undefined;

    return forwardedIp || req.ip || req.socket?.remoteAddress || "unknown";
  }

  protected getRequestResponse(context: ExecutionContext) {
    const http = context.switchToHttp();
    return {
      req: http.getRequest(),
      res: http.getResponse()
    };
  }
}
