import { Body, Controller, Post, UnauthorizedException } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { AuthService } from "./auth.service";
import { GoogleLoginDto } from "./dto/google-login.dto";
import { RefreshTokenDto } from "./dto/refresh-token.dto";

@Controller("auth")
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly jwtService: JwtService
  ) {}

  @Post("google")
  async loginWithGoogle(@Body() dto: GoogleLoginDto) {
    return this.authService.loginWithGoogle(dto);
  }

  @Post("refresh")
  async refresh(@Body() dto: RefreshTokenDto) {
    const payload = this.jwtService.verify<{ sub: string; type: string }>(dto.refreshToken, {
      secret: process.env.JWT_REFRESH_SECRET
    });
    if (payload.type !== "refresh") {
      throw new UnauthorizedException("invalidRefreshTokenType");
    }
    return this.authService.refresh(payload.sub, dto.refreshToken);
  }
}
