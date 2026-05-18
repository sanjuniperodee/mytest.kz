import { IsEnum, IsString, MaxLength, MinLength } from 'class-validator';
import { QuestionAppealReason } from '@prisma/client';

export class CreateQuestionAppealDto {
  @IsEnum(QuestionAppealReason)
  reason!: QuestionAppealReason;

  @IsString()
  @MinLength(12)
  @MaxLength(2000)
  message!: string;
}
