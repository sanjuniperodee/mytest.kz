import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  UseGuards,
  UsePipes,
  ValidationPipe,
} from "@nestjs/common";
import { AuthGuard } from "@nestjs/passport";
import { Throttle } from "@nestjs/throttler";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { GroupDto, MemberDto } from "./social.dto";
import { GroupsService } from "./groups.service";

@Controller("social")
@UseGuards(AuthGuard("jwt"))
@UsePipes(
  new ValidationPipe({
    whitelist: true,
    forbidNonWhitelisted: true,
    transform: true,
  }),
)
export class GroupsController {
  constructor(private readonly groups: GroupsService) {}
  @Post("groups")
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  create(@CurrentUser("id") user: string, @Body() dto: GroupDto) {
    return this.groups.create(user, dto);
  }
  @Get("rooms/:id") detail(
    @CurrentUser("id") user: string,
    @Param("id", ParseUUIDPipe) id: string,
  ) {
    return this.groups.detail(user, id);
  }
  @Patch("groups/:id") settings(
    @CurrentUser("id") user: string,
    @Param("id", ParseUUIDPipe) id: string,
    @Body() dto: GroupDto,
  ) {
    return this.groups.manage(user, id, "settings", dto);
  }
  @Post("groups/:id/invite") rotate(
    @CurrentUser("id") user: string,
    @Param("id", ParseUUIDPipe) id: string,
  ) {
    return this.groups.manage(user, id, "rotate");
  }
  @Delete("groups/:id") archive(
    @CurrentUser("id") user: string,
    @Param("id", ParseUUIDPipe) id: string,
  ) {
    return this.groups.manage(user, id, "archive");
  }
  @Patch("groups/:id/members/:target") member(
    @CurrentUser("id") user: string,
    @Param("id", ParseUUIDPipe) id: string,
    @Param("target", ParseUUIDPipe) target: string,
    @Body() dto: MemberDto,
  ) {
    return this.groups.member(user, id, target, dto.action);
  }
  @Post("groups/:id/leave") leave(
    @CurrentUser("id") user: string,
    @Param("id", ParseUUIDPipe) id: string,
  ) {
    return this.groups.leave(user, id);
  }
  @Get("invites/:token") preview(@Param("token", ParseUUIDPipe) token: string) {
    return this.groups.preview(token);
  }
  @Post("invites/:token/join") join(
    @CurrentUser("id") user: string,
    @Param("token", ParseUUIDPipe) token: string,
  ) {
    return this.groups.join(user, token);
  }
  @Delete("rooms/:id/messages/:message") remove(
    @CurrentUser("id") user: string,
    @Param("id", ParseUUIDPipe) id: string,
    @Param("message", ParseUUIDPipe) message: string,
  ) {
    return this.groups.deleteMessage(user, id, message);
  }
}
