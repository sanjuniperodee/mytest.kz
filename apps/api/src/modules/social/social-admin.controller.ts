import {
  Controller,
  Get,
  Post,
  Delete,
  Param,
  Query,
  ParseUUIDPipe,
  UseGuards,
  UsePipes,
  ValidationPipe,
} from "@nestjs/common";
import { AuthGuard } from "@nestjs/passport";
import { AdminGuard } from "../../common/guards/admin.guard";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { ChatQueryDto } from "./social.dto";
import { ModerationService } from "./moderation.service";
@Controller("admin/social")
@UseGuards(AuthGuard("jwt"), AdminGuard)
@UsePipes(
  new ValidationPipe({
    transform: true,
    whitelist: true,
    forbidNonWhitelisted: true,
  }),
)
export class SocialAdminController {
  constructor(private readonly service: ModerationService) {}
  @Get("rooms") rooms(@Query() query: ChatQueryDto) {
    return this.service.rooms(query);
  }
  @Get("rooms/:id/messages") messages(
    @CurrentUser("id") user: string,
    @Param("id", ParseUUIDPipe) id: string,
    @Query() query: ChatQueryDto,
  ) {
    return this.service.messages(user, id, query);
  }
  @Get("rooms/:id/members") members(@Param("id", ParseUUIDPipe) id: string, @Query() query: ChatQueryDto) {
    return this.service.members(id, query);
  }
  @Get("rooms/:id/audit") audit(@Param("id", ParseUUIDPipe) id: string) {
    return this.service.audit(id);
  }
  @Delete("rooms/:id/messages/:message") deleteMessage(
    @CurrentUser("id") user: string,
    @Param("id", ParseUUIDPipe) id: string,
    @Param("message", ParseUUIDPipe) message: string,
  ) {
    return this.service.deleteMessage(user, id, message);
  }
  @Post("rooms/:id/close") close(
    @CurrentUser("id") user: string,
    @Param("id", ParseUUIDPipe) id: string,
  ) {
    return this.service.close(user, id);
  }
  @Post("rooms/:id/reopen") reopen(
    @CurrentUser("id") user: string,
    @Param("id", ParseUUIDPipe) id: string,
  ) {
    return this.service.reopen(user, id);
  }
  @Get("reports") reports() {
    return this.service.reports();
  }
  @Delete("reports/:id") dismiss(@Param("id", ParseUUIDPipe) id: string) {
    return this.service.dismiss(id);
  }
  @Delete("posts/:id") remove(@Param("id", ParseUUIDPipe) id: string) {
    return this.service.remove(id);
  }
}
