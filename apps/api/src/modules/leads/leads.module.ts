import { Module } from '@nestjs/common';
import { TelegramModule } from '../telegram/telegram.module';
import { LeadsController } from './leads.controller';
import { LeadsService } from './leads.service';

@Module({
  imports: [TelegramModule],
  controllers: [LeadsController],
  providers: [LeadsService],
})
export class LeadsModule {}
