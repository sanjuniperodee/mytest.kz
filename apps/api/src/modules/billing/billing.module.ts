import { Module } from '@nestjs/common';
import { KaspiSessionSetupSecretGuard } from '../../common/guards/kaspi-session-setup-secret.guard';
import { BillingController } from './billing.controller';
import { BillingService } from './billing.service';
import { KaspiPosService } from './kaspi-pos.service';
import { AnalyticsModule } from '../analytics/analytics.module';

@Module({
  imports: [AnalyticsModule],
  controllers: [BillingController],
  providers: [BillingService, KaspiPosService, KaspiSessionSetupSecretGuard],
  exports: [BillingService, KaspiPosService],
})
export class BillingModule {}
