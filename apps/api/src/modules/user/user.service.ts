import { BadRequestException, ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";
import { UpdateProfileDto } from "./dto/update-profile.dto";

@Injectable()
export class UserService {
  constructor(private readonly prisma: PrismaService) {}

  async getMe(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        profileHistory: true
      }
    });
    if (!user) {
      throw new NotFoundException("userNotFound");
    }
    const totalBattles = user.totalWins + user.totalLosses;
    return {
      id: user.id,
      displayName: user.displayName,
      accountTag: user.accountTag ?? this.fallbackAccountTag(user.displayName),
      avatarUrl: user.avatarUrl,
      gender: user.gender,
      level: user.level,
      xp: user.xp,
      coins: user.coins,
      trainingPoints: user.trainingPoints,
      stats: {
        totalWins: user.totalWins,
        totalLosses: user.totalLosses,
        totalBattles,
        winRate: totalBattles === 0 ? 0 : Number(((user.totalWins / totalBattles) * 100).toFixed(2))
      },
      history: user.profileHistory
    };
  }

  async getChampions(userId: string) {
    return this.prisma.userPokemon.findMany({
      where: { userId, isLegacy: false },
      orderBy: [{ wins: "desc" }, { level: "desc" }],
      take: 6,
      include: { species: true }
    });
  }

  async getPublicProfile(targetUserId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: targetUserId },
      include: {
        profileHistory: true,
        pokemons: {
          include: { species: true },
          orderBy: [{ isLegacy: "asc" }, { wins: "desc" }, { level: "desc" }]
        }
      }
    });
    if (!user) {
      throw new NotFoundException("userNotFound");
    }
    const activePokemons = user.pokemons.filter((pokemon) => !pokemon.isLegacy);
    const legacyPokemons = user.pokemons.filter((pokemon) => pokemon.isLegacy);
    return {
      id: user.id,
      displayName: user.displayName,
      accountTag: user.accountTag ?? this.fallbackAccountTag(user.displayName),
      avatarUrl: user.avatarUrl,
      gender: user.gender,
      level: user.level,
      mmr: user.mmr,
      totalWins: user.totalWins,
      totalLosses: user.totalLosses,
      totalPokemons: user.pokemons.length,
      activePokemons,
      legacyPokemons,
      history: user.profileHistory
    };
  }

  async updateProfile(userId: string, dto: UpdateProfileDto) {
    const trimmedDisplayName = dto.displayName?.trim();
    const normalizedAccountTag = dto.accountTag ? this.normalizeAccountTag(dto.accountTag) : undefined;
    const normalizedAvatarUrl = dto.avatarUrl?.trim();
    const normalizedGender = dto.gender;
    const hasAccountTag = typeof normalizedAccountTag === "string";
    const hasAvatarUrl = typeof normalizedAvatarUrl === "string" && normalizedAvatarUrl.length > 0;
    if (!trimmedDisplayName && !normalizedAccountTag && !hasAvatarUrl && !normalizedGender) {
      throw new BadRequestException("profileDataRequired");
    }
    if (hasAccountTag && normalizedAccountTag.length < 3) {
      throw new BadRequestException("invalidAccountTag");
    }
    if (hasAccountTag) {
      const existingTag = await this.prisma.user.findFirst({
        where: {
          accountTag: normalizedAccountTag,
          NOT: { id: userId }
        },
        select: { id: true }
      });
      if (existingTag) {
        throw new ConflictException("accountTagAlreadyExists");
      }
    }
    await this.prisma.user.update({
      where: { id: userId },
      data: {
        displayName: trimmedDisplayName,
        accountTag: normalizedAccountTag,
        avatarUrl: hasAvatarUrl ? normalizedAvatarUrl : undefined,
        gender: normalizedGender
      }
    });
    return this.getMe(userId);
  }

  private normalizeAccountTag(value: string) {
    return value
      .trim()
      .toLowerCase()
      .replace(/^@+/, "")
      .replace(/\s+/g, "");
  }

  private fallbackAccountTag(displayName: string) {
    return displayName
      .trim()
      .toLowerCase()
      .replace(/\s+/g, "");
  }
}
