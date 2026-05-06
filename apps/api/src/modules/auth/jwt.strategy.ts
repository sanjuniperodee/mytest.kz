import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { getRequiredConfig } from '../../common/config/required-config';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(config: ConfigService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: getRequiredConfig(config, 'JWT_SECRET'),
    });
  }

  validate(payload: {
    sub: string;
    telegramId: number | null;
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
