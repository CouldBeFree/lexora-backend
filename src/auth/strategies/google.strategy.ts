import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Profile, Strategy, VerifyCallback } from 'passport-google-oauth20';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class GoogleStrategy extends PassportStrategy(Strategy, 'google') {
  constructor(config: ConfigService) {
    super({
      // Fallback to 'DISABLED' so the app starts without Google credentials.
      // Set GOOGLE_CLIENT_ID + GOOGLE_CLIENT_SECRET in .env to enable the routes.
      clientID: config.get<string>('GOOGLE_CLIENT_ID') || 'DISABLED',
      clientSecret: config.get<string>('GOOGLE_CLIENT_SECRET') || 'DISABLED',
      callbackURL: config.get<string>(
        'GOOGLE_CALLBACK_URL',
        'http://localhost:3010/auth/google/callback',
      ),
      scope: ['email', 'profile'],
    });
  }

  validate(
    _accessToken: string,
    _refreshToken: string,
    profile: Profile,
    done: VerifyCallback,
  ): void {
    done(null, {
      googleId: profile.id,
      email: profile.emails?.[0]?.value ?? '',
      name: profile.displayName,
    });
  }
}
