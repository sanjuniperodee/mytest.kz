import { Body, Controller, Get, Post, Query, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Throttle } from '@nestjs/throttler';
import { ChannelMemberGuard } from '../../common/guards/channel-member.guard';
import { PremiumGuard } from '../../common/guards/premium.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AiCoachService } from './ai-coach.service';
import { AnalyzeMistakesDto } from './dto/analyze-mistakes.dto';
import { ExplainMistakeDto } from './dto/explain-mistake.dto';
import { TopicLessonDto } from './dto/topic-lesson.dto';

@Controller('ai')
@UseGuards(AuthGuard('jwt'), ChannelMemberGuard)
export class AiController {
  constructor(private readonly aiCoach: AiCoachService) {}

  /** Whether AI coaching is configured (lets the UI hide AI features gracefully). */
  @Get('status')
  status() {
    return { enabled: this.aiCoach.isEnabled() };
  }

  /** Instant load of the last stored analysis — no model call, no cost. */
  @Get('mistakes/analysis')
  @UseGuards(PremiumGuard)
  async storedAnalysis(
    @CurrentUser('id') userId: string,
    @Query('examTypeId') examTypeId?: string,
  ) {
    const analysis = await this.aiCoach.getStoredAnalysis(userId, examTypeId || undefined);
    return { enabled: this.aiCoach.isEnabled(), analysis };
  }

  /** Generate (or return cached) AI weak-zone analysis. Premium + tightly throttled. */
  @Post('mistakes/analyze')
  @UseGuards(PremiumGuard)
  @Throttle({ default: { limit: 6, ttl: 60_000 } })
  async analyze(
    @CurrentUser('id') userId: string,
    @Body() dto: AnalyzeMistakesDto,
  ) {
    return this.aiCoach.analyzeWeakZones(userId, {
      language: dto.language,
      examTypeId: dto.examTypeId,
      force: dto.force,
    });
  }

  /** Personalized "why did I get this wrong" explanation for one question. */
  @Post('mistakes/explain')
  @UseGuards(PremiumGuard)
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  async explain(
    @CurrentUser('id') userId: string,
    @Body() dto: ExplainMistakeDto,
  ) {
    return this.aiCoach.explainMistake(userId, {
      questionId: dto.questionId,
      language: dto.language,
    });
  }

  /** Full cached reinforcement lesson for the topic behind an open mistake. */
  @Post('mistakes/topic-lesson')
  @UseGuards(PremiumGuard)
  @Throttle({ default: { limit: 8, ttl: 60_000 } })
  async topicLesson(
    @CurrentUser('id') userId: string,
    @Body() dto: TopicLessonDto,
  ) {
    return this.aiCoach.getTopicLesson(userId, {
      topicId: dto.topicId,
      language: dto.language,
      force: dto.force,
    });
  }
}
