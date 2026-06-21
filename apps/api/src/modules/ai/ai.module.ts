import { Module } from '@nestjs/common';
import { TestsModule } from '../tests/tests.module';
import { TelegramModule } from '../telegram/telegram.module';
import { ChannelMemberGuard } from '../../common/guards/channel-member.guard';
import { PremiumGuard } from '../../common/guards/premium.guard';
import { AdminGuard } from '../../common/guards/admin.guard';
import { AdminAiController } from './admin-ai.controller';
import { AiController } from './ai.controller';
import { AiCoachService } from './ai-coach.service';
import { AiQuotaService } from './ai-quota.service';
import { StudyThemeService } from './study-theme.service';
import { DeepseekClient } from './infrastructure/deepseek.client';

@Module({
  imports: [TestsModule, TelegramModule],
  controllers: [AiController, AdminAiController],
  providers: [
    AiCoachService,
    AiQuotaService,
    StudyThemeService,
    DeepseekClient,
    ChannelMemberGuard,
    PremiumGuard,
    AdminGuard,
  ],
  exports: [AiCoachService, StudyThemeService],
})
export class AiModule {}
