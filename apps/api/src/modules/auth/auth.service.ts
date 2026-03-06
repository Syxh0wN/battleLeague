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

    const user = await this.prisma.user.upsert({
      where: { googleSub },
      update: {
        email,
        displayName: payload.name ?? email.split("@")[0],
        avatarUrl: payload.picture ?? null
      },
      create: {
        googleSub,
        email,
        displayName: payload.name ?? email.split("@")[0],
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

    const accessToken = this.jwtService.sign(
      { email: user.email },
      {
        subject: user.id,
        secret: process.env.JWT_ACCESS_SECRET,
        expiresIn: "15m"
      }
    );

    const refreshToken = this.jwtService.sign(
      { email: user.email, type: "refresh" },
      {
        subject: user.id,
        secret: process.env.JWT_REFRESH_SECRET,
        expiresIn: "30d"
      }
    );

    const refreshTokenHash = await argon2.hash(refreshToken);

    await this.prisma.user.update({
      where: { id: user.id },
      data: { refreshToken: refreshTokenHash }
    });
    await this.auditService.write({
      actorUserId: user.id,
      action: "GoogleLoginSuccess",
      entityName: "User",
      entityId: user.id
    });

    return {
      accessToken,
      refreshToken,
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

    const isValid = await argon2.verify(user.refreshToken, refreshToken);
    if (!isValid) {
      throw new UnauthorizedException("invalidRefreshToken");
    }

    const accessToken = this.jwtService.sign(
      { email: user.email },
      {
        subject: user.id,
        secret: process.env.JWT_ACCESS_SECRET,
        expiresIn: "15m"
      }
    );
    const nextRefreshToken = this.jwtService.sign(
      { email: user.email, type: "refresh" },
      {
        subject: user.id,
        secret: process.env.JWT_REFRESH_SECRET,
        expiresIn: "30d"
      }
    );
    const nextRefreshHash = await argon2.hash(nextRefreshToken);
    await this.prisma.user.update({
      where: { id: user.id },
      data: { refreshToken: nextRefreshHash }
    });
    await this.auditService.write({
      actorUserId: user.id,
      action: "RefreshTokenUsed",
      entityName: "User",
      entityId: user.id
    });
    return { accessToken, refreshToken: nextRefreshToken };
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
}
