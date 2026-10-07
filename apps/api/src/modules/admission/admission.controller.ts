import { Controller, Get, Query } from '@nestjs/common';
import { GrantQuotaType } from '@prisma/client';
import { AdmissionService } from './admission.service';
import {
  AdmissionChanceProgramsQueryDto,
  AdmissionChanceUniversitiesQueryDto,
  AdmissionCompareQueryDto,
  AdmissionCutoffsQueryDto,
  AdmissionHistoryQueryDto,
  AdmissionProfileSubjectsQueryDto,
  AdmissionProgramsQueryDto,
  AdmissionUniversitiesQueryDto,
} from './admission.dto';

@Controller('admission')
export class AdmissionController {
  constructor(private readonly admissionService: AdmissionService) {}

  @Get('cycles')
  listCycles() {
    return this.admissionService.listCycles();
  }

  /** Compact cutoff dataset for the public SEO pages (all universities × ГОП × years). */
  @Get('seo-dataset')
  seoDataset() {
    return this.admissionService.seoDataset();
  }

  @Get('universities')
  listUniversities(@Query() query: AdmissionUniversitiesQueryDto) {
    return this.admissionService.listUniversities({ cycleSlug: query.cycleSlug });
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

  @Get('history')
  history(@Query() query: AdmissionHistoryQueryDto) {
    return this.admissionService.history({
      universityCode: query.universityCode,
      programId: query.programId,
      quotaType: (query.quotaType ?? 'GRANT') as GrantQuotaType,
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

  @Get('chance/profile-subjects')
  listChanceProfileSubjects(@Query() query: AdmissionProfileSubjectsQueryDto) {
    return this.admissionService.listChanceProfileSubjects({
      cycleSlug: query.cycleSlug,
      quotaType: query.quotaType as GrantQuotaType,
      universityCode: query.universityCode,
    });
  }

  @Get('chance/programs')
  listChancePrograms(@Query() query: AdmissionChanceProgramsQueryDto) {
    return this.admissionService.listChancePrograms({
      cycleSlug: query.cycleSlug,
      quotaType: query.quotaType as GrantQuotaType,
      profileSubjects: query.profileSubjects,
      universityCode: query.universityCode,
      programId: query.programId,
      scores: {
        mathLit: query.mathLit,
        readingLit: query.readingLit,
        history: query.history,
        profile1: query.profile1,
        profile2: query.profile2,
      },
    });
  }

  @Get('chance/universities')
  listChanceUniversities(@Query() query: AdmissionChanceUniversitiesQueryDto) {
    return this.admissionService.listChanceUniversities({
      cycleSlug: query.cycleSlug,
      quotaType: query.quotaType as GrantQuotaType,
      programId: query.programId,
      universityCode: query.universityCode,
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
