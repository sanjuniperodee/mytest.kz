import { Transform } from "class-transformer";
import { IsIn, IsOptional, IsString, Length } from "class-validator";

export class UpdateProfileDto {
  @IsOptional()
  @Transform(({ value }) => (typeof value === "string" ? value.trim() : value))
  @IsString()
  @Length(1, 100)
  firstName?: string;

  @IsOptional()
  @Transform(({ value }) => (typeof value === "string" ? value.trim() : value))
  @IsString()
  @Length(0, 100)
  lastName?: string;

  @IsOptional() @IsIn(["ru", "kk"]) preferredLanguage?: string;
  @IsOptional() @IsString() @Length(1, 100) timezone?: string;
}
