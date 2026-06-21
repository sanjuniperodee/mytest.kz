import { AiLessonNoteReason, AiLessonNoteStatus } from '@prisma/client';
import { IsIn, IsOptional, IsString, Length } from 'class-validator';

const LESSON_NOTE_REASONS = Object.values(AiLessonNoteReason);
const LESSON_NOTE_STATUSES = Object.values(AiLessonNoteStatus);

export class CreateLessonNoteDto {
  @IsOptional()
  @IsIn(LESSON_NOTE_REASONS)
  reason?: AiLessonNoteReason;

  @IsString()
  @Length(12, 2000)
  message!: string;
}

export class UpdateLessonNoteDto {
  @IsOptional()
  @IsIn(LESSON_NOTE_STATUSES)
  status?: AiLessonNoteStatus;

  @IsOptional()
  @IsString()
  adminNote?: string;
}
