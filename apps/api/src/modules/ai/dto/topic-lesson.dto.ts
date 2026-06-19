import { IsBoolean, IsOptional, IsString, IsUUID } from 'class-validator';

export class TopicLessonDto {
  @IsUUID()
  topicId!: string;

  @IsString()
  language!: string;

  /** Force a fresh DeepSeek call and update the shared topic lesson cache. */
  @IsOptional()
  @IsBoolean()
  force?: boolean;
}
