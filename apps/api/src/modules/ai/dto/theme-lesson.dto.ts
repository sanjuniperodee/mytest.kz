import { IsBoolean, IsOptional, IsString, IsUUID } from 'class-validator';

export class ThemeLessonDto {
  @IsUUID()
  themeId!: string;

  @IsString()
  language!: string;

  @IsOptional()
  @IsBoolean()
  force?: boolean;
}
