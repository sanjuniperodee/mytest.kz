import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Put,
  Query,
  UseGuards,
  UsePipes,
  ValidationPipe,
} from "@nestjs/common";
import { AuthGuard } from "@nestjs/passport";
import { Throttle } from "@nestjs/throttler";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import {
  FeedDto,
  MessageDto,
  PeopleDto,
  PostDto,
  ReportDto,
  ReadDto,
} from "./social.dto";

import { ChatsService } from "./chats.service";
@Controller("social")
@UseGuards(AuthGuard("jwt"))
@UsePipes(
  new ValidationPipe({
    transform: true,
    whitelist: true,
    forbidNonWhitelisted: true,
  }),
)
export class ChatsController {
  constructor(private readonly service: ChatsService) {}
  @Get("rooms") rooms(@CurrentUser("id") user: string) {
    return this.service.rooms(user);
  }
  @Post("rooms/global") global(@CurrentUser("id") user: string) {
    return this.service.openRoom(user);
  }
  @Post("rooms/direct/:id") direct(
    @CurrentUser("id") user: string,
    @Param("id", ParseUUIDPipe) id: string,
  ) {
    return this.service.openRoom(user, id);
  }
  @Get("rooms/:id/messages") messages(
    @CurrentUser("id") user: string,
    @Param("id", ParseUUIDPipe) id: string,
    @Query() query: FeedDto,
  ) {
    return this.service.messages(user, id, query.cursor);
  }
  @Post("rooms/:id/messages")
  @Throttle({ default: { limit: 30, ttl: 60000 } })
  send(
    @CurrentUser("id") user: string,
    @Param("id", ParseUUIDPipe) id: string,
    @Body() body: MessageDto,
  ) {
    return this.service.send(user, id, body);
  }
  @Put("rooms/:id/read") read(
    @CurrentUser("id") user: string,
    @Param("id", ParseUUIDPipe) id: string,
    @Body() body: ReadDto,
  ) {
    return this.service.read(user, id, body.messageId);
  }
}
