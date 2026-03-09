import { Injectable, UnauthorizedException } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { OAuth2Client, TokenPayload } from "google-auth-library";
import * as argon2 from "argon2";
import { PrismaService } from "../../prisma/prisma.service";
import { AuditService } from "../audit/audit.service";
import { GoogleLoginDto } from "./dto/google-login.dto";

type AuthResponse = {
  accessToken: string;
  refreshToken: string;
  user: {
    id: string;
    email: string;
    displayName: string;
    avatarUrl: string | null;
  };
};

const GoogleDefaultAvatarUrl = "https://www.gstatic.com/images/branding/product/1x/avatar_circle_blue_512dp.png";

@Injectable()
export class AuthService {
  private readonly googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly auditService: AuditService
  ) {}

  async loginWithGoogle(dto: GoogleLoginDto): Promise<AuthResponse> {
    const payload = await this.verifyGoogleToken(dto.idToken);
    const googleSub = payload.sub;
    const email = payload.email;

    if (!googleSub || !email) {
      throw new UnauthorizedException("invalidGooglePayload");
    }

    const displayName = payload.name || payload.given_name || email.split("@")[0];
    const existingUser = await this.prisma.user.findUnique({
      where: { googleSub },
      select: { accountTag: true }
    });
    const preferredAccountTag = existingUser?.accountTag ?? (await this.getAvailableAccountTag(displayName));
    const user = await this.prisma.user.upsert({
      where: { googleSub },
      update: {
        email,
        displayName,
        avatarUrl: payload.picture ?? null,
        accountTag: preferredAccountTag
      },
      create: {
        googleSub,
        email,
        displayName,
        accountTag: preferredAccountTag,
        avatarUrl: payload.picture ?? null,
        profileHistory: {
          create: {
            battleCount: 0,
            bestStreak: 0,
            totalDamage: 0
          }
        }
      }
    });

    if (user.displayName !== displayName) {
      await this.prisma.user.update({
        where: { id: user.id },
        data: { displayName }
      });
      user.displayName = displayName;
    }

    const tokens = await this.issueSessionTokens(user.id, user.email);
    await this.auditService.write({
      actorUserId: user.id,
      action: "GoogleLoginSuccess",
      entityName: "User",
      entityId: user.id
    });

    return {
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      user: {
        id: user.id,
        email: user.email,
        displayName: user.displayName,
        avatarUrl: user.avatarUrl ?? null
      }
    };
  }

  async localAutoLogin(profile?: string): Promise<AuthResponse> {
    const normalizedProfile = (profile ?? "a").trim().toLowerCase() === "b" ? "b" : "a";
    const localGoogleSub = normalizedProfile === "b" ? "localHostUserB" : "localHostUserA";
    const localEmail = normalizedProfile === "b" ? "local.b@battleleague.local" : "local.a@battleleague.local";
    const localDisplayName = normalizedProfile === "b" ? "Treinador Rede" : "Treinador Local";
    const localAccountTag = normalizedProfile === "b" ? "contab" : "contaa";
    const localAvatarUrl =
      normalizedProfile === "b"
        ? "https://api.dicebear.com/9.x/adventurer/svg?seed=TreinadorRede"
        : "https://api.dicebear.com/9.x/adventurer/svg?seed=TreinadorLocal";

    const user = await this.prisma.user.upsert({
      where: { googleSub: localGoogleSub },
      update: {
        email: localEmail,
        avatarUrl: localAvatarUrl
      },
      create: {
        googleSub: localGoogleSub,
        email: localEmail,
        displayName: localDisplayName,
        accountTag: localAccountTag,
        avatarUrl: localAvatarUrl,
        profileHistory: {
          create: {
            battleCount: 0,
            bestStreak: 0,
            totalDamage: 0
          }
        }
      }
    });

    const tokens = await this.issueSessionTokens(user.id, user.email);
    await this.auditService.write({
      actorUserId: user.id,
      action: "LocalAutoLoginSuccess",
      entityName: "User",
      entityId: user.id
    });

    return {
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      user: {
        id: user.id,
        email: user.email,
        displayName: user.displayName,
        avatarUrl: user.avatarUrl ?? null
      }
    };
  }

  async refresh(userId: string, refreshToken: string): Promise<{ accessToken: string; refreshToken: string }> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user?.refreshToken) {
      throw new UnauthorizedException("invalidRefreshToken");
    }
    if (user.googleSub.startsWith("quickLoginLocalUser")) {
      await this.prisma.user.update({
        where: { id: user.id },
        data: { refreshToken: null }
      });
      throw new UnauthorizedException("googleLoginRequired");
    }

    const isValid = await argon2.verify(user.refreshToken, refreshToken);
    if (!isValid) {
      throw new UnauthorizedException("invalidRefreshToken");
    }

    const tokens = await this.issueSessionTokens(user.id, user.email);
    await this.auditService.write({
      actorUserId: user.id,
      action: "RefreshTokenUsed",
      entityName: "User",
      entityId: user.id
    });
    return { accessToken: tokens.accessToken, refreshToken: tokens.refreshToken };
  }

  private async issueSessionTokens(userId: string, email: string): Promise<{ accessToken: string; refreshToken: string }> {
    const accessToken = this.jwtService.sign(
      { email },
      {
        subject: userId,
        secret: process.env.JWT_ACCESS_SECRET,
        expiresIn: "15m"
      }
    );
    const refreshToken = this.jwtService.sign(
      { email, type: "refresh" },
      {
        subject: userId,
        secret: process.env.JWT_REFRESH_SECRET,
        expiresIn: "30d"
      }
    );
    const refreshTokenHash = await argon2.hash(refreshToken);
    await this.prisma.user.update({
      where: { id: userId },
      data: { refreshToken: refreshTokenHash }
    });
    return { accessToken, refreshToken };
  }

  private async verifyGoogleToken(idToken: string): Promise<TokenPayload> {
    const ticket = await this.googleClient.verifyIdToken({
      idToken,
      audience: process.env.GOOGLE_CLIENT_ID
    });
    const payload = ticket.getPayload();
    if (!payload) {
      throw new UnauthorizedException("invalidGoogleToken");
    }
    const validIssuers = ["accounts.google.com", "https://accounts.google.com"];
    if (!payload.iss || !validIssuers.includes(payload.iss)) {
      throw new UnauthorizedException("invalidGoogleIssuer");
    }
    if (!payload.exp || payload.exp * 1000 < Date.now()) {
      throw new UnauthorizedException("expiredGoogleToken");
    }
    if (!payload.email_verified) {
      throw new UnauthorizedException("unverifiedGoogleEmail");
    }
    return payload;
  }

  private normalizeAccountTag(value: string) {
    return value
      .trim()
      .toLowerCase()
      .replace(/^@+/, "")
      .replace(/[^a-z0-9_]/g, "");
  }

  private async getAvailableAccountTag(baseValue: string) {
    const normalizedBase = this.normalizeAccountTag(baseValue) || "treinador";
    let candidate = normalizedBase;
    let suffix = 2;
    while (true) {
      const existing = await this.prisma.user.findFirst({
        where: { accountTag: candidate },
        select: { id: true }
      });
      if (!existing) {
        return candidate;
      }
      candidate = `${normalizedBase}${suffix}`;
      suffix += 1;
    }
  }
}
