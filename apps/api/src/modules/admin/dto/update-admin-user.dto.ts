import { IsBoolean, IsOptional } from 'class-validator';

export class UpdateAdminUserDto {
  @IsOptional()
  @IsBoolean()
  isAdmin?: boolean;
}
