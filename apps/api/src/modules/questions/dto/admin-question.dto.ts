import { Type } from 'class-transformer';
import { Prisma } from '@prisma/client';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';

export class AdminAnswerOptionDto {
  @IsObject()
  content!: Prisma.InputJsonValue;

  @IsBoolean()
  isCorrect!: boolean;

  @IsInt()
  @Min(0)
  sortOrder!: number;
}

export class CreateAdminQuestionDto {
  @IsUUID()
  topicId!: string;

  @IsUUID()
  subjectId!: string;

  @IsUUID()
  examTypeId!: string;

  @IsInt()
  @Min(1)
  @Max(5)
  difficulty!: number;

  @IsIn(['single_choice', 'multiple_choice'])
  type!: 'single_choice' | 'multiple_choice';

  @IsObject()
  content!: Prisma.InputJsonValue;

  @IsOptional()
  @IsObject()
  explanation?: Prisma.InputJsonValue;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @ArrayMaxSize(10)
  imageUrls?: string[];

  @IsOptional()
  @IsIn(['kk', 'ru'])
  contentLocale?: 'kk' | 'ru';

  @IsArray()
  @ArrayMinSize(2)
  @ArrayMaxSize(12)
  @ValidateNested({ each: true })
  @Type(() => AdminAnswerOptionDto)
  answerOptions!: AdminAnswerOptionDto[];

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(5)
  scoreWeight?: number | null;
}

export class UpdateAdminQuestionDto {
  @IsOptional()
  @IsUUID()
  topicId?: string;

  @IsOptional()
  @IsUUID()
  subjectId?: string;

  @IsOptional()
  @IsUUID()
  examTypeId?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(5)
  difficulty?: number;

  @IsOptional()
  @IsIn(['single_choice', 'multiple_choice'])
  type?: 'single_choice' | 'multiple_choice';

  @IsOptional()
  @IsObject()
  content?: Prisma.InputJsonValue;

  @IsOptional()
  @IsObject()
  explanation?: Prisma.InputJsonValue | null;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @ArrayMaxSize(10)
  imageUrls?: string[] | null;

  @IsOptional()
  @IsIn(['kk', 'ru'])
  contentLocale?: 'kk' | 'ru';

  @IsOptional()
  @IsArray()
  @ArrayMinSize(2)
  @ArrayMaxSize(12)
  @ValidateNested({ each: true })
  @Type(() => AdminAnswerOptionDto)
  answerOptions?: AdminAnswerOptionDto[];

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(5)
  scoreWeight?: number | null;
}
