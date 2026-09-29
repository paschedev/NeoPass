import { ExtractJwt, Strategy } from 'passport-jwt';
import { PassportStrategy } from '@nestjs/passport';
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';

// What AuthService signs, plus the issue time that jsonwebtoken adds.
type JwtPayload = { sub: string; email: string; role: string; iat: number };

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    private prisma: PrismaService,
    config: ConfigService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: config.getOrThrow<string>('JWT_SECRET'),
    });
  }

  async validate(payload: JwtPayload) {
    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
    });
    if (!user) {
      throw new UnauthorizedException();
    }
    // A password change or reset closes the sessions opened before it. `iat`
    // has second precision: a token from that same second is still accepted.
    const changedAt = user.passwordChangedAt;
    if (changedAt && payload.iat < Math.floor(changedAt.getTime() / 1000)) {
      throw new UnauthorizedException();
    }
    return { userId: payload.sub, email: payload.email, role: user.role };
  }
}
