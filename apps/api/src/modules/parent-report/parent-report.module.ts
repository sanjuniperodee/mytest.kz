import { Module } from '@nestjs/common';
import { AdmissionModule } from '../admission/admission.module';
import { TestsModule } from '../tests/tests.module';
import { ParentReportRepository } from './infrastructure/parent-report.repository';
import { ParentReportController } from './parent-report.controller';
import { ParentReportService } from './parent-report.service';

@Module({
  imports: [TestsModule, AdmissionModule],
  controllers: [ParentReportController],
  providers: [ParentReportService, ParentReportRepository],
})
export class ParentReportModule {}
