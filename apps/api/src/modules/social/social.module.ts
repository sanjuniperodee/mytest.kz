import { Module } from "@nestjs/common";
import { PrismaModule } from "../../database/prisma.module";
import { AdminGuard } from "../../common/guards/admin.guard";
import { PostsService } from "./posts.service";
import { PeopleService } from "./people.service";
import { ChatsService } from "./chats.service";
import { PostsController } from "./posts.controller";
import { PeopleController } from "./people.controller";
import { ChatsController } from "./chats.controller";
import { SocialAccessService } from "./social-access.service";
import { ChatAccessService } from "./chat-access.service";
import { GroupsController } from "./groups.controller";
import { GroupsService } from "./groups.service";
import { ChatMediaController } from "./chat-media.controller";
import { ChatMediaService } from "./chat-media.service";
import { ChatFileStore } from "./infrastructure/chat-file-store";
import { SocialAdminController } from "./social-admin.controller";
import { ModerationService } from "./moderation.service";
import { ChatRepository } from "./infrastructure/chat.repository";
@Module({
  imports: [PrismaModule],
  controllers: [
    PostsController,
    PeopleController,
    ChatsController,
    GroupsController,
    ChatMediaController,
    SocialAdminController,
  ],
  providers: [
    PostsService,
    PeopleService,
    ChatsService,
    SocialAccessService,
    ChatAccessService,
    ChatRepository,
    GroupsService,
    ChatMediaService,
    ChatFileStore,
    ModerationService,
    AdminGuard,
  ],
})
export class SocialModule {}
