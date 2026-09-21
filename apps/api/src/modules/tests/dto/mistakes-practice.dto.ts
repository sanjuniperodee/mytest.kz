import { IsString, IsOptional, IsUUID, IsInt, IsBoolean, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';

export class MistakesPracticeDto {
  @IsString()
  language!: string;

  @IsOptional()
  @IsUUID()
  examTypeId?: string;

  @IsOptional()
  @IsUUID()
  subjectId?: string;

  @IsOptional()
  @IsUUID()
  topicId?: string;

  @IsOptional()
  @IsUUID()
  themeId?: string;

  @IsOptional()
  @IsBoolean()
  unclassifiedOnly?: boolean;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(200)
  limit?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(300)
  durationMins?: number;
}
