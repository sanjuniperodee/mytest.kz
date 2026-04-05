import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(config: ConfigService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: config.get<string>('JWT_SECRET'),
    });
  }

  validate(payload: {
    sub: string;
    telegramId: number;
    preferredLanguage: string;
    isAdmin: boolean;
    isChannelMember: boolean;
  }) {
    return {
      id: payload.sub,
      telegramId: payload.telegramId,
      preferredLanguage: payload.preferredLanguage,
      isAdmin: payload.isAdmin,
      isChannelMember: payload.isChannelMember,
    };
  }
}
