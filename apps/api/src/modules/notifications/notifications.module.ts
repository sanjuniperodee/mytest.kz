import { Module } from '@nestjs/common';
import { AdminGuard } from '../../common/guards/admin.guard';
import { PrismaModule } from '../../database/prisma.module';
import { TelegramModule } from '../telegram/telegram.module';
import { TestScorerService } from '../tests/test-scorer.service';
import { AdminNotificationsController } from './admin-notifications.controller';
import { MailerService } from './channels/mailer.service';
import { WebPushService } from './channels/web-push.service';
import { NotificationPreferencesService } from './notification-preferences.service';
import { NotificationsController } from './notifications.controller';
import { NotificationsSchedulerService } from './notifications-scheduler.service';
import { NotificationsService } from './notifications.service';

@Module({
  imports: [PrismaModule, TelegramModule],
  controllers: [AdminNotificationsController, NotificationsController],
  providers: [
    NotificationsService,
    NotificationsSchedulerService,
    NotificationPreferencesService,
    MailerService,
    WebPushService,
    TestScorerService,
    AdminGuard,
  ],
  exports: [NotificationsService],
})
export class NotificationsModule {}
