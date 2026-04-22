import { Module } from '@nestjs/common';
import { APP_FILTER } from '@nestjs/core';
import { ConfigModule } from '@nestjs/config';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';
import { PrismaModule } from './database/prisma.module';
import { RedisModule } from './database/redis.module';
import { AuthModule } from './modules/auth/auth.module';
import { UsersModule } from './modules/users/users.module';
import { ExamsModule } from './modules/exams/exams.module';
import { QuestionsModule } from './modules/questions/questions.module';
import { TestsModule } from './modules/tests/tests.module';
import { AdminModule } from './modules/admin/admin.module';
import { TelegramModule } from './modules/telegram/telegram.module';
import { BulkImportModule } from './modules/bulk-import/bulk-import.module';
import { AdmissionModule } from './modules/admission/admission.module';
import { BillingModule } from './modules/billing/billing.module';
import { SubscriptionsModule } from './modules/subscriptions/subscriptions.module';
import { DbSnapshotModule } from './modules/db-snapshot/db-snapshot.module';

@Module({
  providers: [{ provide: APP_FILTER, useClass: AllExceptionsFilter }],
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    RedisModule,
    AuthModule,
    UsersModule,
    ExamsModule,
    QuestionsModule,
    TestsModule,
    AdminModule,
    TelegramModule,
    BulkImportModule,
    AdmissionModule,
    BillingModule,
    SubscriptionsModule,
    DbSnapshotModule,
  ],
})
export class AppModule {}
