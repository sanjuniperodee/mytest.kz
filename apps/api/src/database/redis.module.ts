import {
  Global,
  Inject,
  Injectable,
  Logger,
  Module,
  OnApplicationShutdown,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ModuleRef } from '@nestjs/core';
import Redis from 'ioredis';

export const REDIS_CLIENT = 'REDIS_CLIENT';

@Injectable()
class RedisShutdown implements OnApplicationShutdown {
  constructor(@Inject(REDIS_CLIENT) private readonly redis: Redis) {}

  async onApplicationShutdown() {
    try {
      await this.redis.quit();
    } catch {
      // ignore — shutting down
    }
  }
}

@Global()
@Module({
  providers: [
    {
      provide: REDIS_CLIENT,
      useFactory: (config: ConfigService) => {
        const logger = new Logger('Redis');
        const client = new Redis(
          config.get<string>('REDIS_URL', 'redis://localhost:6379'),
          {
            // Keep the offline queue (default) so a command issued before the
            // socket is ready queues until connected instead of throwing
            // "Stream isn't writeable" during a startup race.
            maxRetriesPerRequest: 3,
          },
        );
        // Attach an error listener so a transient connection drop does not
        // surface as an unhandled error event.
        client.on('error', (err) =>
          logger.warn(`Redis connection error: ${err?.message ?? err}`),
        );
        client.on('ready', () => logger.log('Redis connected'));
        return client;
      },
      inject: [ConfigService],
    },
    RedisShutdown,
  ],
  exports: [REDIS_CLIENT],
})
export class RedisModule implements OnModuleInit {
  private readonly logger = new Logger(RedisModule.name);

  constructor(private readonly moduleRef: ModuleRef) {}

  async onModuleInit() {
    const client = this.moduleRef.get<Redis>(REDIS_CLIENT);
    try {
      await client.ping();
      this.logger.log('Redis ping OK');
    } catch (error) {
      // Do NOT crash the app on a startup race / transient blip — ioredis keeps
      // retrying in the background. Runtime paths that need Redis will surface
      // their own errors if it stays unreachable.
      this.logger.warn(
        `Redis not ready at startup (retrying in background): ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }
  }
}
