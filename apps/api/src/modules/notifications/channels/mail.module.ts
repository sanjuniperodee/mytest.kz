import { Module } from '@nestjs/common';
import { MailerService } from './mailer.service';

/** One MailerService for everyone who sends mail (lifecycle campaigns, sign-in codes). */
@Module({
  providers: [MailerService],
  exports: [MailerService],
})
export class MailModule {}
