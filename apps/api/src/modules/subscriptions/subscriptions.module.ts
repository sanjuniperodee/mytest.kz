import { Global, Module } from '@nestjs/common';
import { AdminGuard } from '../../common/guards/admin.guard';
import { AccessService } from './access.service';
import { MonetizationController } from './monetization.controller';
import { MonetizationService } from './monetization.service';
import { SubscriptionExpiryService } from './subscription-expiry.service';

@Global()
@Module({
  controllers: [MonetizationController],
  providers: [AccessService, MonetizationService, SubscriptionExpiryService, AdminGuard],
  exports: [AccessService, MonetizationService],
})
export class SubscriptionsModule {}
