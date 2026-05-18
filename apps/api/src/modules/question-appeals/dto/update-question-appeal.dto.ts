import { IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';
import { QuestionAppealStatus } from '@prisma/client';

export class UpdateQuestionAppealDto {
  @IsOptional()
  @IsEnum(QuestionAppealStatus)
  status?: QuestionAppealStatus;

  @IsOptional()
  @IsString()
  @MaxLength(4000)
  adminNote?: string;
}
