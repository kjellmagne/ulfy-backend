import { Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";

@Injectable()
export class AuditService {
  constructor(private readonly prisma: PrismaService) {}

  async log(input: {
    actorAdminId?: string;
    actorEmail?: string;
    action: string;
    targetType: string;
    targetId?: string;
    metadata?: unknown;
  }) {
    await this.prisma.activationAuditLog.create({
      data: {
        actorAdminId: input.actorAdminId,
        actorEmail: input.actorEmail,
        action: input.action,
        targetType: input.targetType,
        targetId: input.targetId,
        metadata: (input.metadata ?? {}) as object
      }
    });
  }
}
