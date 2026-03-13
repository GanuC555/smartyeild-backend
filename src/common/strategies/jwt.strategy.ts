import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor() {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey:
        process.env.JWT_SECRET || 'smartyield_jwt_secret_hackathon_2024',
    });
  }

  async validate(payload: any) {
    return {
      sub: payload.sub,
      address: payload.address,
      platformId: payload.platformId,
    };
  }
}
