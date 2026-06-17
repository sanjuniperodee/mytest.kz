import { Module } from '@nestjs/common';
import { AdmissionController } from './admission.controller';
import { AdmissionService } from './admission.service';
import { AdmissionRepository } from './infrastructure/admission.repository';

@Module({
  controllers: [AdmissionController],
  providers: [AdmissionService, AdmissionRepository],
})
export class AdmissionModule {}
