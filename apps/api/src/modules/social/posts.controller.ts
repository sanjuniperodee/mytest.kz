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
import { ActivityDto, FeedDto, MessageDto, PeopleDto, PostDto, ReadDto, ReportDto } from "./social.dto";

import { PostsService } from "./posts.service";
@Controller("social")
@UseGuards(AuthGuard("jwt"))
@UsePipes(
  new ValidationPipe({
    transform: true,
    whitelist: true,
    forbidNonWhitelisted: true,
  }),
)
export class PostsController {
  constructor(private readonly service: PostsService) {}
  @Get("posts") feed(@CurrentUser("id") user: string, @Query() query: FeedDto) {
    return this.service.feed(user, query);
  }
  /** Счётчик для бейджа «Лента»: ответы на мои посты и новые подписчики с момента since. */
  @Get("activity") activity(
    @CurrentUser("id") user: string,
    @Query() query: ActivityDto,
  ) {
    return this.service.activity(user, new Date(query.since));
  }
  @Get("posts/:id") post(
    @CurrentUser("id") user: string,
    @Param("id", ParseUUIDPipe) id: string,
  ) {
    return this.service.post(user, id);
  }
  @Post("posts")
  @Throttle({ default: { limit: 15, ttl: 60000 } })
  create(@CurrentUser("id") user: string, @Body() body: PostDto) {
    return this.service.create(user, body);
  }
  @Delete("posts/:id") remove(
    @CurrentUser("id") user: string,
    @Param("id", ParseUUIDPipe) id: string,
  ) {
    return this.service.remove(user, id);
  }
  @Put("posts/:id/like") like(
    @CurrentUser("id") user: string,
    @Param("id", ParseUUIDPipe) id: string,
  ) {
    return this.service.react(user, id, "like", true);
  }
  @Delete("posts/:id/like") unlike(
    @CurrentUser("id") user: string,
    @Param("id", ParseUUIDPipe) id: string,
  ) {
    return this.service.react(user, id, "like", false);
  }
  @Put("posts/:id/repost") repost(
    @CurrentUser("id") user: string,
    @Param("id", ParseUUIDPipe) id: string,
  ) {
    return this.service.react(user, id, "repost", true);
  }
  @Delete("posts/:id/repost") unrepost(
    @CurrentUser("id") user: string,
    @Param("id", ParseUUIDPipe) id: string,
  ) {
    return this.service.react(user, id, "repost", false);
  }
  @Post("posts/:id/report") report(
    @CurrentUser("id") user: string,
    @Param("id", ParseUUIDPipe) id: string,
    @Body() body: ReportDto,
  ) {
    return this.service.report(user, id, body.reason);
  }
  @Post("posts/:id/view") view(
    @CurrentUser("id") user: string,
    @Param("id", ParseUUIDPipe) id: string,
  ) {
    return this.service.view(user, id);
  }
}
