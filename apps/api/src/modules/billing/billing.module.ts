import { Module } from '@nestjs/common';
import { BillingController } from './billing.controller';
import { BillingService } from './billing.service';
import { KaspiPosService } from './kaspi-pos.service';

@Module({
  controllers: [BillingController],
  providers: [BillingService, KaspiPosService],
  exports: [BillingService, KaspiPosService],
})
export class BillingModule {}
