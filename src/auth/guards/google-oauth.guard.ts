import { ExecutionContext, Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Response } from 'express';

@Injectable()
export class GoogleOAuthGuard extends AuthGuard('google') {
  /** Redirect to frontend error page instead of throwing on denial */
  handleRequest(
    err: unknown,
    user: unknown,
    _info: unknown,
    ctx: ExecutionContext,
  ): any {
    if (err || !user) {
      const res = ctx.switchToHttp().getResponse<Response>();
      const frontendUrl = process.env.FRONTEND_URL ?? 'http://localhost:3000';
      res.redirect(`${frontendUrl}/auth?error=google_denied`);
      return null;
    }
    return user;
  }
}
