import { Controller, Get, Query } from '@nestjs/common';
import { GrantQuotaType } from '@prisma/client';
import { AdmissionService } from './admission.service';
import {
  AdmissionCompareQueryDto,
  AdmissionCutoffsQueryDto,
  AdmissionProgramsQueryDto,
} from './admission.dto';

@Controller('admission')
export class AdmissionController {
  constructor(private readonly admissionService: AdmissionService) {}

  @Get('cycles')
  listCycles() {
    return this.admissionService.listCycles();
  }

  @Get('universities')
  listUniversities() {
    return this.admissionService.listUniversities();
  }

  @Get('programs')
  listPrograms(@Query() query: AdmissionProgramsQueryDto) {
    return this.admissionService.listPrograms({
      code: query.code,
      q: query.q,
      take: query.take,
    });
  }

  @Get('cutoffs')
  listCutoffs(@Query() query: AdmissionCutoffsQueryDto) {
    return this.admissionService.listCutoffs({
      cycleSlug: query.cycleSlug,
      universityCode: query.universityCode,
      programId: query.programId,
      quotaType: query.quotaType as GrantQuotaType | undefined,
    });
  }

  @Get('compare')
  compare(@Query() query: AdmissionCompareQueryDto) {
    return this.admissionService.compare({
      cycleSlug: query.cycleSlug,
      universityCode: query.universityCode,
      programId: query.programId,
      quotaType: query.quotaType as GrantQuotaType,
      scores: {
        mathLit: query.mathLit,
        readingLit: query.readingLit,
        history: query.history,
        profile1: query.profile1,
        profile2: query.profile2,
      },
    });
  }
}
