import { Body, Controller, Get, Param, Patch, UseGuards } from "@nestjs/common";
import { CurrentUser } from "../../common/auth-user.decorator";
import { AuthUser } from "../../common/auth-user.type";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { UpdateProfileDto } from "./dto/update-profile.dto";
import { UserService } from "./user.service";

@Controller("users")
@UseGuards(JwtAuthGuard)
export class UserController {
  constructor(private readonly userService: UserService) {}

  @Get("me")
  async getMe(@CurrentUser() user: AuthUser) {
    return this.userService.getMe(user.userId);
  }

  @Get("me/champions")
  async getMyChampions(@CurrentUser() user: AuthUser) {
    return this.userService.getChampions(user.userId);
  }

  @Patch("me/profile")
  async updateMyProfile(@CurrentUser() user: AuthUser, @Body() dto: UpdateProfileDto) {
    return this.userService.updateProfile(user.userId, dto);
  }

  @Get(":userId")
  async getPublicProfile(@Param("userId") userId: string) {
    return this.userService.getPublicProfile(userId);
  }
}
