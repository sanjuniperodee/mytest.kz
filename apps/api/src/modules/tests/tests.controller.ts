import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  UseGuards,
  BadRequestException,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ChannelMemberGuard } from '../../common/guards/channel-member.guard';
import { PremiumGuard } from '../../common/guards/premium.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { TestSessionService } from './test-session.service';
import { MistakesService } from './mistakes.service';

@Controller('tests')
@UseGuards(AuthGuard('jwt'), ChannelMemberGuard)
export class TestsController {
  constructor(
    private testSessionService: TestSessionService,
    private mistakesService: MistakesService,
  ) {}

  @Get('mistakes/summary')
  async mistakesSummary(@CurrentUser('id') userId: string) {
    return this.mistakesService.getSummary(userId);
  }

  @Post('mistakes/practice')
  async mistakesPractice(
    @CurrentUser('id') userId: string,
    @Body('language') language: string,
    @Body('examTypeId') examTypeId?: string,
    @Body('limit') limit?: number,
    @Body('durationMins') durationMins?: number,
  ) {
    if (!language || typeof language !== 'string') {
      throw new BadRequestException('language required');
    }
    return this.testSessionService.startRemediationSession(userId, language, {
      examTypeId,
      limit: typeof limit === 'number' ? limit : undefined,
      durationMins: typeof durationMins === 'number' ? durationMins : undefined,
    });
  }

  @Post('start')
  async startTest(
    @CurrentUser('id') userId: string,
    @Body('templateId') templateId: string,
    @Body('language') language: string,
    @Body('profileSubjectIds') profileSubjectIds?: string[],
    @Body('entScope') entScope?: 'mandatory' | 'profile' | 'full',
  ) {
    return this.testSessionService.startTest(
      userId,
      templateId,
      language,
      profileSubjectIds,
      entScope,
    );
  }

  @Get('sessions')
  async getSessions(
    @CurrentUser('id') userId: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.testSessionService.getSessions(
      userId,
      page ? parseInt(page, 10) : 1,
      limit ? parseInt(limit, 10) : 10,
    );
  }

  @Get('sessions/:id')
  async getSession(
    @CurrentUser('id') userId: string,
    @Param('id') sessionId: string,
  ) {
    return this.testSessionService.getSession(sessionId, userId);
  }

  @Post('sessions/:id/answer')
  async submitAnswer(
    @CurrentUser('id') userId: string,
    @Param('id') sessionId: string,
    @Body('questionId') questionId: string,
    @Body('selectedIds') selectedIds: string[],
  ) {
    return this.testSessionService.submitAnswer(
      sessionId,
      userId,
      questionId,
      selectedIds,
    );
  }

  @Post('sessions/:id/finish')
  async finishTest(
    @CurrentUser('id') userId: string,
    @Param('id') sessionId: string,
  ) {
    return this.testSessionService.finishTest(sessionId, userId);
  }

  @Get('sessions/:id/review')
  async getReview(
    @CurrentUser('id') userId: string,
    @Param('id') sessionId: string,
  ) {
    return this.testSessionService.getReview(sessionId, userId);
  }

  @Get('sessions/:id/review/:questionId/explanation')
  @UseGuards(PremiumGuard)
  async getExplanation(
    @CurrentUser('id') userId: string,
    @Param('id') sessionId: string,
    @Param('questionId') questionId: string,
  ) {
    return this.testSessionService.getExplanation(sessionId, userId, questionId);
  }
}
