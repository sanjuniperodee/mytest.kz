import { Type } from 'class-transformer';
import {
  Allow,
  ArrayMaxSize,
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

export class UpsertExamTypeDto {
  @IsString()
  slug!: string;

  @IsString()
  nameRu!: string;

  @IsOptional()
  @IsString()
  nameKk?: string;

  @IsOptional()
  @IsString()
  nameEn?: string;

  @IsOptional()
  @IsString()
  descriptionRu?: string;

  @IsOptional()
  @IsString()
  descriptionKk?: string;

  @IsOptional()
  @IsString()
  descriptionEn?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class UpsertSubjectDto {
  @IsString()
  examTypeSlug!: string;

  @IsString()
  slug!: string;

  @IsString()
  nameRu!: string;

  @IsOptional()
  @IsString()
  nameKk?: string;

  @IsOptional()
  @IsString()
  nameEn?: string;

  @IsOptional()
  @IsInt()
  sortOrder?: number;

  @IsOptional()
  @IsBoolean()
  isMandatory?: boolean;
}

export class CreateTopicDto {
  /** Либо subjectId, либо пара slug-ов */
  @IsOptional()
  @IsString()
  subjectId?: string;

  @IsOptional()
  @IsString()
  examTypeSlug?: string;

  @IsOptional()
  @IsString()
  subjectSlug?: string;

  @IsString()
  topicNameRu!: string;

  @IsOptional()
  @IsString()
  topicNameKk?: string;

  @IsOptional()
  @IsString()
  topicNameEn?: string;

  @IsOptional()
  @IsInt()
  sortOrder?: number;
}

export class AnswerBatchItemDto {
  @IsString()
  textRu!: string;

  @IsOptional()
  @IsString()
  textKk?: string;

  @IsOptional()
  @IsString()
  textEn?: string;

  @IsBoolean()
  isCorrect!: boolean;
}

export class QuestionBatchItemDto {
  @IsString()
  examTypeSlug!: string;

  @IsString()
  subjectSlug!: string;

  /** Тема: найдётся по ru-названию или будет создана */
  @IsString()
  topicNameRu!: string;

  @IsInt()
  @Min(1)
  @Max(5)
  difficulty!: number;

  @IsIn(['single_choice', 'multiple_choice'])
  type!: 'single_choice' | 'multiple_choice';

  @IsString()
  contentRu!: string;

  @IsOptional()
  @IsString()
  contentKk?: string;

  @IsOptional()
  @IsString()
  contentEn?: string;

  /** Язык текста вопроса для выборки в тестах (по умолчанию ru) */
  @IsOptional()
  @IsIn(['kk', 'ru'])
  contentLocale?: 'kk' | 'ru';

  @IsOptional()
  @IsString()
  explanationRu?: string;

  @IsOptional()
  @IsString()
  explanationKk?: string;

  @IsOptional()
  @IsString()
  explanationEn?: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => AnswerBatchItemDto)
  @ArrayMaxSize(12)
  answers!: AnswerBatchItemDto[];
}

export class BatchQuestionsDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => QuestionBatchItemDto)
  @ArrayMaxSize(50)
  questions!: QuestionBatchItemDto[];
}

export class TemplateSectionDto {
  @IsString()
  subjectSlug!: string;

  @IsInt()
  @Min(1)
  questionCount!: number;

  @IsOptional()
  @IsIn(['random', 'ordered'])
  selectionMode?: 'random' | 'ordered';

  @IsOptional()
  @IsInt()
  sortOrder?: number;
}

export class CreateTestTemplateDto {
  @IsString()
  examTypeSlug!: string;

  @IsString()
  nameRu!: string;

  @IsOptional()
  @IsString()
  nameKk?: string;

  @IsOptional()
  @IsString()
  nameEn?: string;

  @IsInt()
  @Min(1)
  durationMins!: number;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => TemplateSectionDto)
  sections!: TemplateSectionDto[];
}

export class PatchBulkQuestionDto {
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(5)
  difficulty?: number;

  @IsOptional()
  @Allow()
  content?: unknown;

  @IsOptional()
  @Allow()
  explanation?: unknown;
}
