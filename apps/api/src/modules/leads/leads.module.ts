import { Module } from '@nestjs/common';
import { PrismaModule } from '../../database/prisma.module';
import { TelegramModule } from '../telegram/telegram.module';
import { LeadsController } from './leads.controller';
import { LeadsService } from './leads.service';

@Module({
  imports: [PrismaModule, TelegramModule],
  controllers: [LeadsController],
  providers: [LeadsService],
})
export class LeadsModule {}
