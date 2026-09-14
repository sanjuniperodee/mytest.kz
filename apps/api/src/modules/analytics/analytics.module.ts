import { Module } from '@nestjs/common';
import { AnalyticsController } from './analytics.controller';
import { AnalyticsService } from './analytics.service';
import { PrismaModule } from '../../database/prisma.module';
import { TestFeedbackController } from './test-feedback.controller';
import { TestFeedbackService } from './test-feedback.service';
import { GrowthAnalyticsService } from './growth-analytics.service';

@Module({
  imports: [PrismaModule],
  controllers: [AnalyticsController, TestFeedbackController],
  providers: [AnalyticsService, TestFeedbackService, GrowthAnalyticsService],
  exports: [AnalyticsService, GrowthAnalyticsService],
})
export class AnalyticsModule {}
