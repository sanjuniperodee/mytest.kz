import { Module } from '@nestjs/common';
import { APP_FILTER, APP_GUARD } from '@nestjs/core';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import Redis from 'ioredis';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';
import { RedisThrottlerStorage } from './common/throttling/redis-throttler-storage';
import { PrismaModule } from './database/prisma.module';
import { REDIS_CLIENT, RedisModule } from './database/redis.module';
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
import { LeadsModule } from './modules/leads/leads.module';
import { SettingsModule } from './modules/settings/settings.module';
import { AnalyticsModule } from './modules/analytics/analytics.module';
import { LeaderboardModule } from './modules/leaderboard/leaderboard.module';
import { NotificationsModule } from './modules/notifications/notifications.module';
import { QuestionAppealsModule } from './modules/question-appeals/question-appeals.module';

function validateProductionConfig(config: Record<string, unknown>) {
  if (config.NODE_ENV !== 'production') return config;
  const required = [
    'JWT_SECRET',
    'JWT_REFRESH_SECRET',
    'KASPI_WEBHOOK_SECRET',
    'REDIS_URL',
    ...(typeof config.APPLE_IAP_SHARED_SECRET === 'string' &&
    config.APPLE_IAP_SHARED_SECRET.trim()
      ? ['APPLE_IAP_BUNDLE_ID']
      : []),
  ];
  const missing = required.filter((key) => {
    const value = config[key];
    return typeof value !== 'string' || value.trim().length === 0;
  });
  if (missing.length > 0) {
    throw new Error(`Missing required production config: ${missing.join(', ')}`);
  }
  return config;
}

@Module({
  providers: [
    { provide: APP_FILTER, useClass: AllExceptionsFilter },
    { provide: APP_GUARD, useClass: ThrottlerGuard },
  ],
  imports: [
    ConfigModule.forRoot({ isGlobal: true, validate: validateProductionConfig }),
    ThrottlerModule.forRootAsync({
      imports: [RedisModule],
      inject: [REDIS_CLIENT],
      useFactory: (redis: Redis) => ({
        throttlers: [{ ttl: 60_000, limit: 100 }],
        storage: new RedisThrottlerStorage(redis),
      }),
    }),
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
    LeadsModule,
    SettingsModule,
    AnalyticsModule,
    LeaderboardModule,
    NotificationsModule,
    QuestionAppealsModule,
  ],
})
export class AppModule {}
