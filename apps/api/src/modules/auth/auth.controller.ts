import { Body, Controller, ForbiddenException, Post, Query, Req, Res, UnauthorizedException } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { Throttle } from "@nestjs/throttler";
import type { Request, Response } from "express";
import { AuthService } from "./auth.service";
import { GoogleLoginDto } from "./dto/google-login.dto";
import { RefreshTokenDto } from "./dto/refresh-token.dto";

@Controller("auth")
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly jwtService: JwtService
  ) {}

  private SetRefreshTokenCookie(response: Response, refreshToken: string) {
    response.cookie("BattleLeagueRefreshToken", refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/"
    });
  }

  private ClearRefreshTokenCookie(response: Response) {
    response.cookie("BattleLeagueRefreshToken", "", {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      expires: new Date(0)
    });
  }

  private ExtractRefreshTokenFromCookie(request: Request): string | null {
    const rawCookieHeader = request.headers.cookie;
    if (!rawCookieHeader) {
      return null;
    }
    const cookieParts = rawCookieHeader.split(";").map((part) => part.trim());
    const refreshCookie = cookieParts.find((part) => part.startsWith("BattleLeagueRefreshToken="));
    if (!refreshCookie) {
      return null;
    }
    const [, value] = refreshCookie.split("=");
    return value ? decodeURIComponent(value) : null;
  }

  @Post("google")
  @Throttle({ default: { limit: 8, ttl: 60_000 } })
  async loginWithGoogle(@Body() dto: GoogleLoginDto, @Res({ passthrough: true }) response: Response) {
    const result = await this.authService.loginWithGoogle(dto);
    this.SetRefreshTokenCookie(response, result.refreshToken);
    return {
      accessToken: result.accessToken,
      user: result.user
    };
  }

  @Post("local-auto")
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  async localAutoLogin(@Query("profile") profile: string | undefined, @Res({ passthrough: true }) response: Response) {
    if (process.env.NODE_ENV === "production") {
      throw new ForbiddenException("localAutoLoginDisabledInProduction");
    }
    const result = await this.authService.localAutoLogin(profile);
    this.SetRefreshTokenCookie(response, result.refreshToken);
    return {
      accessToken: result.accessToken,
      user: result.user
    };
  }

  @Post("refresh")
  @Throttle({ default: { limit: 15, ttl: 60_000 } })
  async refresh(@Body() dto: RefreshTokenDto, @Req() request: Request, @Res({ passthrough: true }) response: Response) {
    const tokenFromCookie = this.ExtractRefreshTokenFromCookie(request);
    const refreshToken = tokenFromCookie ?? dto.refreshToken;
    if (!refreshToken) {
      this.ClearRefreshTokenCookie(response);
      throw new UnauthorizedException("missingRefreshToken");
    }
    let payload: { sub: string; type: string };
    try {
      payload = this.jwtService.verify<{ sub: string; type: string }>(refreshToken, {
        secret: process.env.JWT_REFRESH_SECRET
      });
    } catch {
      this.ClearRefreshTokenCookie(response);
      throw new UnauthorizedException("invalidRefreshToken");
    }
    if (payload.type !== "refresh") {
      this.ClearRefreshTokenCookie(response);
      throw new UnauthorizedException("invalidRefreshTokenType");
    }
    const refreshed = await this.authService.refresh(payload.sub, refreshToken);
    this.SetRefreshTokenCookie(response, refreshed.refreshToken);
    return { accessToken: refreshed.accessToken };
  }
}
