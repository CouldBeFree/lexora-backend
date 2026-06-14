import { Injectable, UnauthorizedException } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  handleRequest(err: unknown, user: unknown): any {
    if (err || !user) {
      throw new UnauthorizedException({ message: 'Unauthorized' });
    }
    return user;
  }
}
