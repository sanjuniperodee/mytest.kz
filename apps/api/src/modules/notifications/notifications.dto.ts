import { Type } from 'class-transformer';
import {
  IsNumber,
  IsOptional,
  IsString,
  IsUrl,
  Length,
  Matches,
  MaxLength,
  ValidateNested,
} from 'class-validator';

const BASE64URL = /^[A-Za-z0-9_-]+={0,2}$/;

export class PushKeysDto {
  @IsString()
  @Length(80, 120)
  @Matches(BASE64URL)
  p256dh!: string;

  @IsString()
  @Length(16, 48)
  @Matches(BASE64URL)
  auth!: string;
}

/** `PushSubscription.toJSON()` from the browser. */
export class PushSubscribeDto {
  @IsString()
  @MaxLength(2048)
  @IsUrl({ protocols: ['https'], require_protocol: true, require_tld: true })
  endpoint!: string;

  @IsOptional()
  @IsNumber()
  expirationTime?: number | null;

  @ValidateNested()
  @Type(() => PushKeysDto)
  keys!: PushKeysDto;
}

export class PushUnsubscribeDto {
  @IsString()
  @MaxLength(2048)
  endpoint!: string;
}
