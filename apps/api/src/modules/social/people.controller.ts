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

import { PeopleService } from "./people.service";
@Controller("social")
@UseGuards(AuthGuard("jwt"))
@UsePipes(
  new ValidationPipe({
    transform: true,
    whitelist: true,
    forbidNonWhitelisted: true,
  }),
)
export class PeopleController {
  constructor(private readonly service: PeopleService) {}
  @Get("people") people(
    @CurrentUser("id") user: string,
    @Query() query: PeopleDto,
  ) {
    return this.service.people(user, query);
  }
  @Get("people/:id") profile(
    @CurrentUser("id") user: string,
    @Param("id", ParseUUIDPipe) id: string,
  ) {
    return this.service.profile(user, id);
  }
  @Put("people/:id/follow") follow(
    @CurrentUser("id") user: string,
    @Param("id", ParseUUIDPipe) id: string,
  ) {
    return this.service.follow(user, id, true);
  }
  @Delete("people/:id/follow") unfollow(
    @CurrentUser("id") user: string,
    @Param("id", ParseUUIDPipe) id: string,
  ) {
    return this.service.follow(user, id, false);
  }
  @Put("people/:id/block") block(
    @CurrentUser("id") user: string,
    @Param("id", ParseUUIDPipe) id: string,
  ) {
    return this.service.block(user, id, true);
  }
  @Delete("people/:id/block") unblock(
    @CurrentUser("id") user: string,
    @Param("id", ParseUUIDPipe) id: string,
  ) {
    return this.service.block(user, id, false);
  }
}
