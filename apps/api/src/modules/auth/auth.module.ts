import { Module, forwardRef } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { TelegramAuthService } from './telegram-auth.service';
import { JwtStrategy } from './jwt.strategy';
import { TelegramModule } from '../telegram/telegram.module';

@Module({
  imports: [
    PassportModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      useFactory: (config: ConfigService) => ({
        secret: config.get<string>('JWT_SECRET'),
        signOptions: { expiresIn: '15m' },
      }),
      inject: [ConfigService],
    }),
    forwardRef(() => TelegramModule),
  ],
  controllers: [AuthController],
  providers: [AuthService, TelegramAuthService, JwtStrategy],
  exports: [AuthService],
})
export class AuthModule {}
