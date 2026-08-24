import { IsIn, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class VerifyStorePurchaseDto {
  @IsIn(['ios', 'android'])
  platform!: 'ios' | 'android';

  @IsString()
  @MinLength(3)
  @MaxLength(200)
  productId!: string;

  @IsString()
  @MinLength(16)
  @MaxLength(10000)
  purchaseToken!: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  transactionId?: string;
}
