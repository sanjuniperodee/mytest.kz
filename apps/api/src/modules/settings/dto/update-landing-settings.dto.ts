import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsBoolean,
  IsArray,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUrl,
  MaxLength,
  ValidateNested,
} from 'class-validator';

class HeroSlideDto {
  @IsOptional()
  @IsString()
  @MaxLength(120)
  title?: string;

  @IsOptional()
  @IsString()
  @MaxLength(240)
  subtitle?: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(1000)
  desktopImageUrl!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(1000)
  tabletImageUrl!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(1000)
  mobileImageUrl!: string;

  @IsOptional()
  @IsString()
  @MaxLength(60)
  buttonLabel?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  buttonHref?: string;

  @IsOptional()
  @IsBoolean()
  showButton?: boolean;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class UpdateLandingSettingsDto {
  @IsOptional()
  @IsUrl({ require_protocol: true })
  @MaxLength(1000)
  instructionVideoUrl?: string;

  @IsOptional()
  @IsUrl({ require_protocol: true })
  @MaxLength(500)
  instagramUrl?: string;

  @IsOptional()
  @IsUrl({ require_protocol: true })
  @MaxLength(500)
  tiktokUrl?: string;

  @IsOptional()
  @IsUrl({ require_protocol: true })
  @MaxLength(500)
  whatsappUrl?: string;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(10)
  @ValidateNested({ each: true })
  @Type(() => HeroSlideDto)
  heroSlides?: HeroSlideDto[];
}
