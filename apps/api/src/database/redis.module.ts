import { Global, Inject, Injectable, Module, OnApplicationShutdown, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ModuleRef } from '@nestjs/core';
import Redis from 'ioredis';

export const REDIS_CLIENT = 'REDIS_CLIENT';

@Injectable()
class RedisShutdown implements OnApplicationShutdown {
  constructor(@Inject(REDIS_CLIENT) private readonly redis: Redis) {}

  async onApplicationShutdown() {
    await this.redis.quit();
  }
}

@Global()
@Module({
  providers: [
    {
      provide: REDIS_CLIENT,
      useFactory: (config: ConfigService) => {
        return new Redis(config.get<string>('REDIS_URL', 'redis://localhost:6379'), {
          enableOfflineQueue: false,
          maxRetriesPerRequest: 2,
        });
      },
      inject: [ConfigService],
    },
    RedisShutdown,
  ],
  exports: [REDIS_CLIENT],
})
export class RedisModule implements OnModuleInit {
  constructor(private readonly moduleRef: ModuleRef) {}

  async onModuleInit() {
    const client = this.moduleRef.get<Redis>(REDIS_CLIENT);
    try {
      await client.ping();
    } catch (error) {
      throw new Error(`Failed to connect to Redis: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
}
