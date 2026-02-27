import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { HomeworkTemplateController } from './homework-template.controller';
import { HomeworkTemplateService } from './homework-template.service';

@Module({
  imports: [PrismaModule],
  controllers: [HomeworkTemplateController],
  providers: [HomeworkTemplateService],
  exports: [HomeworkTemplateService],
})
export class HomeworkTemplateModule {}
