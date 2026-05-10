import { Module } from '@nestjs/common';
import { KaspiSessionSetupSecretGuard } from '../../common/guards/kaspi-session-setup-secret.guard';
import { BillingController } from './billing.controller';
import { BillingService } from './billing.service';
import { KaspiPosService } from './kaspi-pos.service';

@Module({
  controllers: [BillingController],
  providers: [BillingService, KaspiPosService, KaspiSessionSetupSecretGuard],
  exports: [BillingService, KaspiPosService],
})
export class BillingModule {}
