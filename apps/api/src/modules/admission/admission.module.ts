import { Module } from '@nestjs/common';
import { AdmissionController } from './admission.controller';
import { AdmissionGoalController } from './admission-goal.controller';
import { AdmissionService } from './admission.service';
import { AdmissionGoalService } from './admission-goal.service';
import { AdmissionRepository } from './infrastructure/admission.repository';

@Module({
  controllers: [AdmissionController, AdmissionGoalController],
  providers: [AdmissionService, AdmissionGoalService, AdmissionRepository],
})
export class AdmissionModule {}
