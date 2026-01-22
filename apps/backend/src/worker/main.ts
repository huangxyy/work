import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { WorkerModule } from './worker.module';

async function bootstrapWorker() {
  const app = await NestFactory.createApplicationContext(WorkerModule);
  const logger = new Logger('Worker');
  logger.log('Worker started and listening for jobs');

  const shutdown = async () => {
    await app.close();
    logger.log('Worker shut down');
    process.exit(0);
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

bootstrapWorker();