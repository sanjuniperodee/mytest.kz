import { Transform } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsString, Length, Max, Min } from 'class-validator';

export class TestFeedbackDto {
  @IsInt() @Min(1) @Max(5) rating!: number;
  @IsIn(['price', 'value', 'payment', 'trust', 'later', 'other', 'none']) blocker!: string;
  @IsIn(['yes', 'maybe', 'no', 'already_paid']) intent!: string;
  @IsIn(['ru', 'kk']) locale!: string;
  @IsOptional()
  @Transform(({ value }) => typeof value === 'string' ? value.trim() : value)
  @IsString() @Length(0, 1000) comment?: string;
}
