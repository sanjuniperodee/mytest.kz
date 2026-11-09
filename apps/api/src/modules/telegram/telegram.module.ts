import { Module, forwardRef } from '@nestjs/common';
import { QotdChannelService } from './qotd-channel.service';
import { TelegramBotService } from './telegram-bot.service';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [forwardRef(() => AuthModule)],
  providers: [TelegramBotService, QotdChannelService],
  exports: [TelegramBotService],
})
export class TelegramModule {}
