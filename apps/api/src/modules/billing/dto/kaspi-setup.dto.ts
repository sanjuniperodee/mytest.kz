import { IsString, MinLength } from 'class-validator';

export class KaspiSetupRequestCodeDto {
  @IsString()
  @MinLength(10)
  phoneNumber!: string;
}

export class KaspiSetupVerifyOtpDto {
  @IsString()
  @MinLength(1)
  processId!: string;

  @IsString()
  @MinLength(4)
  otp!: string;
}
