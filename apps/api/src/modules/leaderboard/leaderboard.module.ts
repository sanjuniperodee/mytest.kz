import { Module } from '@nestjs/common';
import { ChannelMemberGuard } from '../../common/guards/channel-member.guard';
import { TelegramModule } from '../telegram/telegram.module';
import { LeaderboardController } from './leaderboard.controller';
import { LeaderboardService } from './leaderboard.service';

@Module({
  imports: [TelegramModule],
  controllers: [LeaderboardController],
  providers: [LeaderboardService, ChannelMemberGuard],
})
export class LeaderboardModule {}
