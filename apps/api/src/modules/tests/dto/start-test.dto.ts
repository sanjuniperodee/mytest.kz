import { IsUUID, IsString, IsOptional, IsArray, IsIn } from 'class-validator';
import { ENT_SCOPES, type EntScope } from '@bilimland/shared';

export class StartTestDto {
  @IsUUID()
  templateId!: string;

  @IsString()
  language!: string;

  @IsOptional()
  @IsArray()
  @IsUUID('4', { each: true })
  profileSubjectIds?: string[];

  /** mandatory | profile | full | creative | express (короткий тест по всем 5 предметам). */
  @IsOptional()
  @IsIn([...ENT_SCOPES])
  entScope?: EntScope;
}
