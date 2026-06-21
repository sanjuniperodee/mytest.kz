import { IsBoolean, IsOptional, IsString, IsUUID } from 'class-validator';

export class ThemeLessonDto {
  @IsUUID()
  themeId!: string;

  @IsString()
  language!: string;

  /** Ignored for students; lesson refreshes are controlled server/admin-side. */
  @IsOptional()
  @IsBoolean()
  force?: boolean;
}
