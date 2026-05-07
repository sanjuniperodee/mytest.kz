import { Module } from '@nestjs/common';
import { AdminGuard } from '../../common/guards/admin.guard';
import { PrismaModule } from '../../database/prisma.module';
import { TelegramModule } from '../telegram/telegram.module';
import { AdminNotificationsController } from './admin-notifications.controller';
import { NotificationsSchedulerService } from './notifications-scheduler.service';
import { NotificationsService } from './notifications.service';

@Module({
  imports: [PrismaModule, TelegramModule],
  controllers: [AdminNotificationsController],
  providers: [NotificationsService, NotificationsSchedulerService, AdminGuard],
  exports: [NotificationsService],
})
export class NotificationsModule {}
