import {
  Controller,
  Get,
  Query,
  UsePipes,
  ValidationPipe,
} from "@nestjs/common";
import { Throttle } from "@nestjs/throttler";
import { PostsService } from "./posts.service";
import { PublicDiscussionsDto } from "./social.dto";

/**
 * Единственная открытая часть сообщества: вопросы, заданные на страницах проходных
 * баллов вузов и специальностей. Их рендерят SEO-страницы сайта (ISR) — поэтому без
 * JWT. Закрытые посты ленты сюда не попадают никогда (фильтр isPublic в сервисе).
 */
@Controller("social/public")
@UsePipes(
  new ValidationPipe({
    transform: true,
    whitelist: true,
    forbidNonWhitelisted: true,
  }),
)
export class PublicSocialController {
  constructor(private readonly posts: PostsService) {}

  @Get("discussions")
  @Throttle({ default: { limit: 60, ttl: 60000 } })
  discussions(@Query() query: PublicDiscussionsDto) {
    return this.posts.publicDiscussions(query.topicKey, query.cursor);
  }
}
