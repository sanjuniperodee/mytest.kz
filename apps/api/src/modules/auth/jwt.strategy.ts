import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { getRequiredConfig } from '../../common/config/required-config';
import { PrismaService } from '../../database/prisma.service';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    config: ConfigService,
    private readonly prisma: PrismaService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: getRequiredConfig(config, 'JWT_SECRET'),
    });
  }

  validate(payload: {
    sub: string;
    sid?: string;
    telegramId: number | null;
    preferredLanguage: string;
    isAdmin: boolean;
    isChannelMember: boolean;
  }) {
    if (!payload.sid) {
      throw new UnauthorizedException('Session is not active');
    }
    return this.prisma.authSession.findFirst({
      where: {
        id: payload.sid,
        userId: payload.sub,
        revokedAt: null,
        expiresAt: { gt: new Date() },
      },
      select: { id: true },
    }).then((session) => {
      if (!session) {
        throw new UnauthorizedException('Session is not active');
      }
      return {
        id: payload.sub,
        sessionId: payload.sid,
        telegramId: payload.telegramId,
        preferredLanguage: payload.preferredLanguage,
        isAdmin: payload.isAdmin,
        isChannelMember: payload.isChannelMember,
      };
    });
  }
}
