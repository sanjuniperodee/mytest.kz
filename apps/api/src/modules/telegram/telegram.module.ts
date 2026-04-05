import { Module, forwardRef } from '@nestjs/common';
import { TelegramBotService } from './telegram-bot.service';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [forwardRef(() => AuthModule)],
  providers: [TelegramBotService],
  exports: [TelegramBotService],
})
export class TelegramModule {}
