import { Module } from '@nestjs/common';
import { KaspiSessionSetupSecretGuard } from '../../common/guards/kaspi-session-setup-secret.guard';
import { BillingController } from './billing.controller';
import { BillingService } from './billing.service';
import { KaspiPosService } from './kaspi-pos.service';
import { KaspiReconcileService } from './kaspi-reconcile.service';
import { AnalyticsModule } from '../analytics/analytics.module';
import { ParentPayController } from './parent-pay/parent-pay.controller';
import { ParentPayService } from './parent-pay/parent-pay.service';

@Module({
  imports: [AnalyticsModule],
  controllers: [BillingController, ParentPayController],
  providers: [
    BillingService,
    KaspiPosService,
    KaspiReconcileService,
    KaspiSessionSetupSecretGuard,
    ParentPayService,
  ],
  exports: [BillingService, KaspiPosService],
})
export class BillingModule {}
