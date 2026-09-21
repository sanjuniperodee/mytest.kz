import { Module } from '@nestjs/common';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';
import { TelegramModule } from '../telegram/telegram.module';
import { StatisticsController } from './statistics.controller';
import { StatisticsService } from './statistics.service';
import { StatisticsRepository } from './infrastructure/statistics.repository';

@Module({
  imports: [TelegramModule],
  controllers: [UsersController, StatisticsController],
  providers: [UsersService, StatisticsService, StatisticsRepository],
  exports: [UsersService],
})
export class UsersModule {}
