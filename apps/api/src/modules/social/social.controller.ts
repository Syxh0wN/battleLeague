import { Body, Controller, Get, Post, UseGuards } from "@nestjs/common";
import { CurrentUser } from "../../common/auth-user.decorator";
import { AuthUser } from "../../common/auth-user.type";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { FriendActionDto } from "./dto/friend-action.dto";
import { FriendRequestDto } from "./dto/friend-request.dto";
import { SocialService } from "./social.service";

@Controller("social")
@UseGuards(JwtAuthGuard)
export class SocialController {
  constructor(private readonly socialService: SocialService) {}

  @Post("friends/request")
  async sendRequest(@CurrentUser() user: AuthUser, @Body() dto: FriendRequestDto) {
    return this.socialService.sendFriendRequest(user.userId, dto);
  }

  @Post("friends/accept")
  async acceptRequest(@CurrentUser() user: AuthUser, @Body() dto: FriendActionDto) {
    return this.socialService.acceptFriendRequest(user.userId, dto);
  }

  @Get("friends")
  async listFriends(@CurrentUser() user: AuthUser) {
    return this.socialService.listFriends(user.userId);
  }

  @Get("friends/pending")
  async listPending(@CurrentUser() user: AuthUser) {
    return this.socialService.listPendingRequests(user.userId);
  }
}
