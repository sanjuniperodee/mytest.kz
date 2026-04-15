import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsString, IsUUID, Max, Min } from 'class-validator';

export class AdmissionProgramsQueryDto {
  @IsOptional()
  @IsString()
  code?: string;

  @IsOptional()
  @IsString()
  q?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(500)
  take?: number;
}

export class AdmissionCutoffsQueryDto {
  @IsString()
  cycleSlug!: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  universityCode?: number;

  @IsOptional()
  @IsUUID()
  programId?: string;

  @IsOptional()
  @IsIn(['GRANT', 'RURAL'])
  quotaType?: 'GRANT' | 'RURAL';
}

export class AdmissionCompareQueryDto {
  @IsString()
  cycleSlug!: string;

  @Type(() => Number)
  @IsInt()
  universityCode!: number;

  @IsUUID()
  programId!: string;

  @IsIn(['GRANT', 'RURAL'])
  quotaType!: 'GRANT' | 'RURAL';

  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(10)
  mathLit!: number;

  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(10)
  readingLit!: number;

  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(20)
  history!: number;

  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(50)
  profile1!: number;

  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(50)
  profile2!: number;
}
