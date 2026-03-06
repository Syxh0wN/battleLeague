import { Injectable } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";

type AuditInput = {
  actorUserId?: string;
  action: string;
  entityName: string;
  entityId?: string;
  payload?: unknown;
};

@Injectable()
export class AuditService {
  constructor(private readonly prisma: PrismaService) {}

  async write(input: AuditInput) {
    return this.prisma.auditLog.create({
      data: {
        actorUserId: input.actorUserId ?? null,
        action: input.action,
        entityName: input.entityName,
        entityId: input.entityId ?? null,
        payload: input.payload ? JSON.stringify(input.payload) : null
      }
    });
  }
}
