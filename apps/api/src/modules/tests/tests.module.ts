import { Module } from '@nestjs/common';
import { TestsController } from './tests.controller';
import { TestSessionService } from './test-session.service';
import { TestGeneratorService } from './test-generator.service';
import { TestScorerService } from './test-scorer.service';
import { MistakesService } from './mistakes.service';
import { TelegramModule } from '../telegram/telegram.module';
import { ChannelMemberGuard } from '../../common/guards/channel-member.guard';
import { PremiumGuard } from '../../common/guards/premium.guard';
import { ExplanationAccessGuard } from '../../common/guards/explanation-access.guard';

@Module({
  imports: [TelegramModule],
  controllers: [TestsController],
  providers: [
    TestSessionService,
    TestGeneratorService,
    TestScorerService,
    MistakesService,
    ChannelMemberGuard,
    PremiumGuard,
    ExplanationAccessGuard,
  ],
  exports: [TestSessionService, MistakesService, TestScorerService],
})
export class TestsModule {}
