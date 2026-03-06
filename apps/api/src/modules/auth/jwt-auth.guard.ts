import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { AuthUser } from "../../common/auth-user.type";

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(private readonly jwtService: JwtService) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<{ headers: Record<string, string>; user?: AuthUser }>();
    const authHeader = request.headers.authorization;
    if (!authHeader?.startsWith("Bearer ")) {
      throw new UnauthorizedException("missingBearerToken");
    }

    const token = authHeader.replace("Bearer ", "");
    const payload = this.jwtService.verify<{ sub: string; email: string }>(token, {
      secret: process.env.JWT_ACCESS_SECRET
    });
    request.user = {
      userId: payload.sub,
      email: payload.email
    };
    return true;
  }
}
