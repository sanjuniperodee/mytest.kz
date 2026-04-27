import { IsUUID, IsArray } from 'class-validator';

export class SubmitAnswerDto {
  @IsUUID()
  questionId!: string;

  @IsArray()
  @IsUUID('4', { each: true })
  selectedIds!: string[];
}
