import { IsBoolean, IsOptional, IsString, IsUUID } from 'class-validator';

export class AnalyzeMistakesDto {
  @IsString()
  language!: string;

  @IsOptional()
  @IsUUID()
  examTypeId?: string;

  @IsOptional()
  @IsUUID()
  subjectId?: string;

  /** Force a fresh DeepSeek call even if a cached analysis exists for this mistake set. */
  @IsOptional()
  @IsBoolean()
  force?: boolean;
}
