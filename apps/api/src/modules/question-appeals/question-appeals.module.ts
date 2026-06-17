import { Module } from '@nestjs/common';
import { PrismaModule } from '../../database/prisma.module';
import { TelegramModule } from '../telegram/telegram.module';
import { ChannelMemberGuard } from '../../common/guards/channel-member.guard';
import { AdminGuard } from '../../common/guards/admin.guard';
import { QuestionAppealsController } from './question-appeals.controller';
import { AdminQuestionAppealsController } from './admin-question-appeals.controller';
import { QuestionAppealsService } from './question-appeals.service';

@Module({
  imports: [PrismaModule, TelegramModule],
  controllers: [QuestionAppealsController, AdminQuestionAppealsController],
  providers: [QuestionAppealsService, ChannelMemberGuard, AdminGuard],
  exports: [QuestionAppealsService],
})
export class QuestionAppealsModule {}
