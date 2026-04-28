import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus } from "@nestjs/common";
import { Response } from "express";
import { mobileError } from "./activation.service";

@Catch(HttpException)
export class MobileExceptionFilter implements ExceptionFilter {
  catch(exception: HttpException, host: ArgumentsHost) {
    const response = host.switchToHttp().getResponse<Response>();
    const status = exception.getStatus?.() ?? HttpStatus.INTERNAL_SERVER_ERROR;
    const body = exception.getResponse();
    const normalized = this.normalize(status, body, exception.message);
    response.status(status).json(normalized);
  }

  private normalize(status: number, body: string | object, fallbackMessage: string) {
    if (typeof body === "object" && body && "error" in body) {
      const error = (body as any).error;
      if (typeof error === "object" && error?.code && error?.message) {
        return mobileError(error.code, error.message);
      }
      if (typeof error === "string" && typeof (body as any).message === "string") {
        return mobileError(this.codeFor(status, (body as any).message), (body as any).message);
      }
      if (typeof error === "string") {
        return mobileError(this.codeFor(status, error), error);
      }
    }

    if (typeof body === "object" && body && "message" in body) {
      const message = (body as any).message;
      const text = Array.isArray(message) ? message.join("; ") : String(message);
      return mobileError(this.codeFor(status, text), text);
    }

    const text = typeof body === "string" ? body : fallbackMessage;
    return mobileError(this.codeFor(status, text), text);
  }

  private codeFor(status: number, message: string) {
    if (status === HttpStatus.BAD_REQUEST) return "request_invalid";
    if (status === HttpStatus.NOT_FOUND) return "not_found";
    if (status === HttpStatus.UNAUTHORIZED || status === HttpStatus.FORBIDDEN) return "activation_forbidden";
    return message.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "") || "request_failed";
  }
}
