import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { ReportsController } from './reports.controller';
import { ReportsService } from './reports.service';
import { StudentReportsController } from './student-reports.controller';

@Module({
  imports: [PrismaModule],
  controllers: [ReportsController, StudentReportsController],
  providers: [ReportsService],
})
export class ReportsModule {}
