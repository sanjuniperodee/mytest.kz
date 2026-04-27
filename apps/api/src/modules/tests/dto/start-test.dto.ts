import { IsUUID, IsString, IsOptional, IsArray, IsEnum } from 'class-validator';

export class StartTestDto {
  @IsUUID()
  templateId!: string;

  @IsString()
  language!: string;

  @IsOptional()
  @IsArray()
  @IsUUID('4', { each: true })
  profileSubjectIds?: string[];

  @IsOptional()
  @IsEnum(['mandatory', 'profile', 'full'])
  entScope?: 'mandatory' | 'profile' | 'full';
}
