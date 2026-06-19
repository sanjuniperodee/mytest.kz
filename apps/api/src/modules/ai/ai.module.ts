import { Module } from '@nestjs/common';
import { TestsModule } from '../tests/tests.module';
import { TelegramModule } from '../telegram/telegram.module';
import { ChannelMemberGuard } from '../../common/guards/channel-member.guard';
import { PremiumGuard } from '../../common/guards/premium.guard';
import { AiController } from './ai.controller';
import { AiCoachService } from './ai-coach.service';
import { AiQuotaService } from './ai-quota.service';
import { DeepseekClient } from './infrastructure/deepseek.client';

@Module({
  imports: [TestsModule, TelegramModule],
  controllers: [AiController],
  providers: [AiCoachService, AiQuotaService, DeepseekClient, ChannelMemberGuard, PremiumGuard],
  exports: [AiCoachService],
})
export class AiModule {}
