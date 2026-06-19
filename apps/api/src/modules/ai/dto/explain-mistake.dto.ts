import { IsString, IsUUID } from 'class-validator';

export class ExplainMistakeDto {
  @IsUUID()
  questionId!: string;

  @IsString()
  language!: string;
}
