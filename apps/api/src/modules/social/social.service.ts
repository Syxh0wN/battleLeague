import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { FriendshipStatus } from "@prisma/client";
import { PrismaService } from "../../prisma/prisma.service";
import { AuditService } from "../audit/audit.service";
import { FriendActionDto } from "./dto/friend-action.dto";
import { FriendRequestDto } from "./dto/friend-request.dto";

@Injectable()
export class SocialService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService
  ) {}

  async sendFriendRequest(userId: string, dto: FriendRequestDto) {
    const targetUserId = await this.resolveTargetUserId(dto.targetUserId);
    if (userId === targetUserId) {
      throw new BadRequestException("cannotAddSelf");
    }
    const target = await this.prisma.user.findUnique({ where: { id: targetUserId } });
    if (!target) {
      throw new NotFoundException("targetUserNotFound");
    }
    const existing = await this.prisma.friendship.findFirst({
      where: {
        OR: [
          { senderId: userId, receiverId: targetUserId },
          { senderId: targetUserId, receiverId: userId }
        ]
      }
    });
    if (existing) {
      throw new BadRequestException("friendshipAlreadyExists");
    }
    const friendship = await this.prisma.friendship.create({
      data: {
        senderId: userId,
        receiverId: targetUserId,
        status: FriendshipStatus.pending
      }
    });
    await this.auditService.write({
      actorUserId: userId,
      action: "FriendRequestSent",
      entityName: "Friendship",
      entityId: friendship.id
    });
    return friendship;
  }

  async acceptFriendRequest(userId: string, dto: FriendActionDto) {
    const friendship = await this.prisma.friendship.findUnique({ where: { id: dto.friendshipId } });
    if (!friendship) {
      throw new NotFoundException("friendshipNotFound");
    }
    if (friendship.receiverId !== userId) {
      throw new ForbiddenException("friendshipAccessDenied");
    }
    const friendshipUpdated = await this.prisma.friendship.update({
      where: { id: friendship.id },
      data: { status: FriendshipStatus.accepted }
    });
    await this.auditService.write({
      actorUserId: userId,
      action: "FriendRequestAccepted",
      entityName: "Friendship",
      entityId: friendship.id
    });
    return friendshipUpdated;
  }

  async listFriends(userId: string) {
    const accepted = await this.prisma.friendship.findMany({
      where: {
        status: FriendshipStatus.accepted,
        OR: [{ senderId: userId }, { receiverId: userId }]
      },
      include: {
        sender: { select: { id: true, displayName: true, accountTag: true, avatarUrl: true, level: true } },
        receiver: { select: { id: true, displayName: true, accountTag: true, avatarUrl: true, level: true } }
      }
    });
    return accepted.map((friendship) => (friendship.senderId === userId ? friendship.receiver : friendship.sender));
  }

  async listPendingRequests(userId: string) {
    return this.prisma.friendship.findMany({
      where: {
        status: FriendshipStatus.pending,
        receiverId: userId
      },
      include: {
        sender: {
          select: {
            id: true,
            displayName: true,
            accountTag: true,
            avatarUrl: true,
            level: true
          }
        }
      }
    });
  }

  private normalizeProfileTag(value: string) {
    return value
      .trim()
      .toLowerCase()
      .replace(/^@+/, "")
      .replace(/\s+/g, "");
  }

  private async resolveTargetUserId(rawTarget: string) {
    const normalizedTarget = this.normalizeProfileTag(rawTarget);
    if (!normalizedTarget) {
      throw new BadRequestException("targetUserNotFound");
    }
    if (!rawTarget.trim().startsWith("@")) {
      return rawTarget.trim();
    }
    const accountTagMatch = await this.prisma.user.findFirst({
      where: { accountTag: normalizedTarget },
      select: { id: true }
    });
    if (accountTagMatch) {
      return accountTagMatch.id;
    }
    const users = await this.prisma.user.findMany({
      select: { id: true, displayName: true }
    });
    const displayNameMatch = users.find((user) => this.normalizeProfileTag(user.displayName) === normalizedTarget);
    if (!displayNameMatch) {
      throw new NotFoundException("targetUserNotFound");
    }
    return displayNameMatch.id;
  }
}
