import {
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Response } from 'express';
import * as bcrypt from 'bcrypt';
import { UsersService } from '../users/users.service';
import { User } from '../users/entities/user.entity';
import { RegisterDto } from './dto/register.dto';

@Injectable()
export class AuthService {
  constructor(
    private readonly users: UsersService,
    private readonly jwt: JwtService,
  ) {}

  // ── Local auth ──────────────────────────────────────────────────────────────

  async validatePassword(email: string, password: string): Promise<User> {
    const user = await this.users.findByEmail(email);
    if (!user?.passwordHash) {
      throw new UnauthorizedException({ message: 'Wrong email or password' });
    }
    const match = await bcrypt.compare(password, user.passwordHash);
    if (!match)
      throw new UnauthorizedException({ message: 'Wrong email or password' });
    return user;
  }

  async register(dto: RegisterDto): Promise<User> {
    const existing = await this.users.findByEmail(dto.email);
    if (existing)
      throw new ConflictException({ message: 'Email already registered' });
    const passwordHash = await bcrypt.hash(dto.password, 10);
    return this.users.create({
      name: dto.name,
      email: dto.email,
      passwordHash,
    });
  }

  // ── Google OAuth ────────────────────────────────────────────────────────────

  async findOrCreateGoogleUser(profile: {
    googleId: string;
    email: string;
    name: string;
  }): Promise<User> {
    // 1. Already linked
    const byGoogle = await this.users.findByGoogleId(profile.googleId);
    if (byGoogle) return byGoogle;

    // 2. Email exists from password registration → link
    const byEmail = await this.users.findByEmail(profile.email);
    if (byEmail) {
      byEmail.googleId = profile.googleId;
      return this.users.save(byEmail);
    }

    // 3. Brand-new user
    return this.users.create({
      googleId: profile.googleId,
      email: profile.email,
      name: profile.name,
      passwordHash: null,
    });
  }

  // ── Helpers ─────────────────────────────────────────────────────────────────

  async getMe(userId: string) {
    const user = await this.users.findById(userId);
    if (!user) throw new UnauthorizedException({ message: 'Unauthorized' });
    return this.toPublic(user);
  }

  signToken(userId: string): string {
    return this.jwt.sign({ sub: userId });
  }

  setSessionCookie(res: Response, token: string): void {
    res.cookie('lx_session', token, {
      httpOnly: true,
      sameSite: 'lax',
      path: '/',
      maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days in ms
      secure: process.env.NODE_ENV === 'production',
    });
  }

  clearSessionCookie(res: Response): void {
    res.clearCookie('lx_session', { path: '/' });
  }

  toPublic(user: User): { id: string; name: string; email: string } {
    return { id: user.id, name: user.name, email: user.email };
  }
}
