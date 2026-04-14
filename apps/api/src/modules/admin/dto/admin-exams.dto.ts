import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';

export class NameI18nDto {
  @IsString()
  ru!: string;

  @IsOptional()
  @IsString()
  kk?: string;

  @IsOptional()
  @IsString()
  en?: string;
}

export class CreateExamTypeDto {
  @IsString()
  slug!: string;

  @ValidateNested()
  @Type(() => NameI18nDto)
  name!: NameI18nDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => NameI18nDto)
  description?: NameI18nDto;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class UpdateExamTypeDto {
  @ValidateNested()
  @Type(() => NameI18nDto)
  name!: NameI18nDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => NameI18nDto)
  description?: NameI18nDto;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class CreateSubjectDto {
  @IsString()
  slug!: string;

  @ValidateNested()
  @Type(() => NameI18nDto)
  name!: NameI18nDto;

  @IsOptional()
  @IsBoolean()
  isMandatory?: boolean;

  @IsOptional()
  @IsInt()
  sortOrder?: number;
}

export class UpdateSubjectDto {
  @IsOptional()
  @IsString()
  slug?: string;

  @ValidateNested()
  @Type(() => NameI18nDto)
  name!: NameI18nDto;

  @IsOptional()
  @IsBoolean()
  isMandatory?: boolean;

  @IsOptional()
  @IsInt()
  sortOrder?: number;
}

export class CreateTopicDto {
  @ValidateNested()
  @Type(() => NameI18nDto)
  name!: NameI18nDto;

  @IsOptional()
  @IsInt()
  sortOrder?: number;
}

export class UpdateTopicDto {
  @ValidateNested()
  @Type(() => NameI18nDto)
  name!: NameI18nDto;

  @IsOptional()
  @IsInt()
  sortOrder?: number;
}

export class TemplateSectionInputDto {
  @IsString()
  subjectId!: string;

  @IsInt()
  @Min(1)
  @Max(500)
  questionCount!: number;

  @IsOptional()
  @IsIn(['random', 'ordered'])
  selectionMode?: 'random' | 'ordered';

  @IsOptional()
  @IsInt()
  sortOrder?: number;
}

export class CreateTestTemplateDto {
  @ValidateNested()
  @Type(() => NameI18nDto)
  name!: NameI18nDto;

  @IsInt()
  @Min(1)
  @Max(600)
  durationMins!: number;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => TemplateSectionInputDto)
  sections!: TemplateSectionInputDto[];
}

export class UpdateTestTemplateDto {
  @ValidateNested()
  @Type(() => NameI18nDto)
  name!: NameI18nDto;

  @IsInt()
  @Min(1)
  @Max(600)
  durationMins!: number;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class ReplaceTemplateSectionsDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => TemplateSectionInputDto)
  sections!: TemplateSectionInputDto[];
}
