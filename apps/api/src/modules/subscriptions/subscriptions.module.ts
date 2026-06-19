import { Global, Module } from '@nestjs/common';
import { AccessService } from './access.service';
import { SubscriptionExpiryService } from './subscription-expiry.service';

@Global()
@Module({
  providers: [AccessService, SubscriptionExpiryService],
  exports: [AccessService],
})
export class SubscriptionsModule {}
