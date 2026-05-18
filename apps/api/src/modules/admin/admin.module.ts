import { Module } from '@nestjs/common';
import { AdminUsersController } from './admin-users.controller';
import { AdminSubscriptionsController } from './admin-subscriptions.controller';
import { AdminAnalyticsController } from './admin-analytics.controller';
import { AdminExamsController } from './admin-exams.controller';
import { AdminFinanceController } from './admin-finance.controller';
import { AdminExamsService } from './admin-exams.service';
import { AdminService } from './admin.service';
import { AdminUserService } from './services/admin-user.service';
import { AdminSubscriptionService } from './services/admin-subscription.service';
import { AdminPlanTemplateService } from './services/admin-plan-template.service';
import { AdminAnalyticsService } from './services/admin-analytics.service';
import { AdminFinanceService } from './services/admin-finance.service';
import { PrismaModule } from '../../database/prisma.module';
import { AnalyticsModule } from '../analytics/analytics.module';
import { BillingModule } from '../billing/billing.module';

@Module({
  imports: [PrismaModule, AnalyticsModule, BillingModule],
  controllers: [
    AdminUsersController,
    AdminSubscriptionsController,
    AdminAnalyticsController,
    AdminExamsController,
    AdminFinanceController,
  ],
  providers: [
    AdminService,
    AdminExamsService,
    AdminUserService,
    AdminSubscriptionService,
    AdminPlanTemplateService,
    AdminAnalyticsService,
    AdminFinanceService,
  ],
})
export class AdminModule {}
