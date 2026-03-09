import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from "@nestjs/common";
import { AuthUser } from "./auth-user.type";

@Injectable()
export class AdminUserGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<{ user?: AuthUser }>();
    const user = request.user;
    if (!user) {
      throw new ForbiddenException("missingAuthenticatedUser");
    }
    const allowedIds = (process.env.ADMIN_USER_IDS ?? "")
      .split(",")
      .map((value) => value.trim())
      .filter((value) => value.length > 0);
    const allowedEmails = (process.env.ADMIN_USER_EMAILS ?? "")
      .split(",")
      .map((value) => value.trim().toLowerCase())
      .filter((value) => value.length > 0);
    const isAllowedById = allowedIds.includes(user.userId);
    const isAllowedByEmail = allowedEmails.includes(user.email.toLowerCase());
    if (!isAllowedById && !isAllowedByEmail) {
      throw new ForbiddenException("adminOnlyEndpoint");
    }
    return true;
  }
}
