import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ChannelMemberGuard } from '../../common/guards/channel-member.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { LeaderboardService } from './leaderboard.service';

@Controller('leaderboard')
@UseGuards(AuthGuard('jwt'), ChannelMemberGuard)
export class LeaderboardController {
  constructor(private leaderboardService: LeaderboardService) {}

  @Get('ent')
  async getEntLeaderboard(
    @CurrentUser('id') userId: string,
    @Query('limit') limit?: string,
  ) {
    return this.leaderboardService.getEntLeaderboard(
      userId,
      limit ? parseInt(limit, 10) : 50,
    );
  }
}
