import { Module } from '@nestjs/common';
import { AdminUsersController } from './admin-users.controller';
import { AdminSubscriptionsController } from './admin-subscriptions.controller';
import { AdminAnalyticsController } from './admin-analytics.controller';
import { AdminService } from './admin.service';

@Module({
  controllers: [
    AdminUsersController,
    AdminSubscriptionsController,
    AdminAnalyticsController,
  ],
  providers: [AdminService],
})
export class AdminModule {}
