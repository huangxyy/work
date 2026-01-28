import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { BullModule } from '@nestjs/bullmq';
import { QueueModule } from '../queue/queue.module';
import { PrismaModule } from '../prisma/prisma.module';
import { GradingProcessor } from './grading.processor';
import { StorageModule } from '../storage/storage.module';
import { GradingModule } from '../grading/grading.module';
import { SystemConfigModule } from '../system-config/system-config.module';

const buildRedisConnection = (redisUrl: string) => {
  try {
    const url = new URL(redisUrl);
    const port = url.port ? parseInt(url.port, 10) : 6379;
    return {
      host: url.hostname,
      port,
      username: url.username || undefined,
      password: url.password || undefined,
    };
  } catch {
    return { host: 'localhost', port: 6379 };
  }
};

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, envFilePath: '.env' }),
    BullModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: async (config: ConfigService) => ({
        connection: {
          ...buildRedisConnection(config.get<string>('REDIS_URL') || 'redis://localhost:6379'),
        },
      }),
    }),
    PrismaModule,
    StorageModule,
    GradingModule,
    QueueModule,
    SystemConfigModule,
  ],
  providers: [GradingProcessor],
})
export class WorkerModule {}
