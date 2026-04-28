import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ChannelMemberGuard } from '../../common/guards/channel-member.guard';
import { PremiumGuard } from '../../common/guards/premium.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { TestSessionService } from './test-session.service';
import { MistakesService } from './mistakes.service';
import { StartTestDto } from './dto/start-test.dto';
import { MistakesPracticeDto } from './dto/mistakes-practice.dto';
import { SubmitAnswerDto } from './dto/submit-answer.dto';

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
    @Body() dto: MistakesPracticeDto,
  ) {
    return this.testSessionService.startRemediationSession(userId, dto.language, {
      examTypeId: dto.examTypeId,
      limit: dto.limit,
      durationMins: dto.durationMins,
    });
  }

  @Post('start')
  async startTest(
    @CurrentUser('id') userId: string,
    @Body() dto: StartTestDto,
  ) {
    return this.testSessionService.startTest(
      userId,
      dto.templateId,
      dto.language,
      dto.profileSubjectIds,
      dto.entScope,
    );
  }

  @Get('sessions')
  async getSessions(
    @CurrentUser('id') userId: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('examTypeId') examTypeId?: string,
    @Query('status') status?: string,
  ) {
    return this.testSessionService.getSessions(
      userId,
      page ? parseInt(page, 10) : 1,
      limit ? parseInt(limit, 10) : 10,
      {
        examTypeId,
        status:
          status === 'in_progress' ||
          status === 'completed' ||
          status === 'timed_out' ||
          status === 'abandoned'
            ? status
            : undefined,
      },
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
    @Body() dto: SubmitAnswerDto,
  ) {
    return this.testSessionService.submitAnswer(
      sessionId,
      userId,
      dto.questionId,
      dto.selectedIds,
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
