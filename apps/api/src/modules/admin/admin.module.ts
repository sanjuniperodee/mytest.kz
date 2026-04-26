import { Module } from '@nestjs/common';
import { AdminUsersController } from './admin-users.controller';
import { AdminSubscriptionsController } from './admin-subscriptions.controller';
import { AdminAnalyticsController } from './admin-analytics.controller';
import { AdminExamsController } from './admin-exams.controller';
import { AdminExamsService } from './admin-exams.service';
import { AdminService } from './admin.service';
import { PrismaModule } from '../../database/prisma.module';
import { AnalyticsModule } from '../analytics/analytics.module';

@Module({
  imports: [PrismaModule, AnalyticsModule],
  controllers: [
    AdminUsersController,
    AdminSubscriptionsController,
    AdminAnalyticsController,
    AdminExamsController,
  ],
  providers: [AdminService, AdminExamsService],
})
export class AdminModule {}
