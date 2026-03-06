import { Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";

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
      avatarUrl: user.avatarUrl,
      level: user.level,
      xp: user.xp,
      coins: user.coins,
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
      where: { userId },
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
          orderBy: [{ wins: "desc" }, { level: "desc" }],
          take: 6
        }
      }
    });
    if (!user) {
      throw new NotFoundException("userNotFound");
    }
    return {
      id: user.id,
      displayName: user.displayName,
      avatarUrl: user.avatarUrl,
      level: user.level,
      totalWins: user.totalWins,
      totalLosses: user.totalLosses,
      champions: user.pokemons,
      history: user.profileHistory
    };
  }
}
