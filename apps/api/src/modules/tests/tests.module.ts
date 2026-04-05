import { Module } from '@nestjs/common';
import { TestsController } from './tests.controller';
import { TestSessionService } from './test-session.service';
import { TestGeneratorService } from './test-generator.service';
import { TestScorerService } from './test-scorer.service';
import { MistakesService } from './mistakes.service';
import { TelegramModule } from '../telegram/telegram.module';
import { ChannelMemberGuard } from '../../common/guards/channel-member.guard';

@Module({
  imports: [TelegramModule],
  controllers: [TestsController],
  providers: [
    TestSessionService,
    TestGeneratorService,
    TestScorerService,
    MistakesService,
    ChannelMemberGuard,
  ],
  exports: [TestSessionService],
})
export class TestsModule {}
