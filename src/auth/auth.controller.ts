import {
  Body,
  Controller,
  Get,
  HttpCode,
  Post,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Request, Response } from 'express';
import { AuthService } from './auth.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { GoogleOAuthGuard } from './guards/google-oauth.guard';
import { AuthGuard } from '@nestjs/passport';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly config: ConfigService,
  ) {}

  // ── POST /auth/register ──────────────────────────────────────────────────
  @Post('register')
  async register(
    @Body() dto: RegisterDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const user = await this.authService.register(dto);
    const token = this.authService.signToken(user.id);
    this.authService.setSessionCookie(res, token);
    return this.authService.toPublic(user);
  }

  // ── POST /auth/login ─────────────────────────────────────────────────────
  @Post('login')
  @HttpCode(200)
  async login(
    @Body() dto: LoginDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    // validatePassword throws 401 on failure — DTO pipe handles 400 first
    const user = await this.authService.validatePassword(
      dto.email,
      dto.password,
    );
    const token = this.authService.signToken(user.id);
    this.authService.setSessionCookie(res, token);
    return this.authService.toPublic(user);
  }

  // ── POST /auth/logout ────────────────────────────────────────────────────
  @Post('logout')
  @HttpCode(200)
  logout(@Res({ passthrough: true }) res: Response) {
    this.authService.clearSessionCookie(res);
    return { ok: true };
  }

  // ── GET /auth/me ─────────────────────────────────────────────────────────
  @Get('me')
  @UseGuards(JwtAuthGuard)
  me(@Req() req: Request) {
    const { id } = req.user as { id: string };
    return this.authService.getMe(id);
  }

  // ── GET /auth/google ─────────────────────────────────────────────────────
  @Get('google')
  @UseGuards(AuthGuard('google'))
  googleAuth() {
    // Passport redirects to Google — no body needed
  }

  // ── GET /auth/google/callback ────────────────────────────────────────────
  @Get('google/callback')
  @UseGuards(GoogleOAuthGuard)
  async googleCallback(@Req() req: Request, @Res() res: Response) {
    if (!req.user) return; // guard already redirected to /auth?error=google_denied

    const profile = req.user as {
      googleId: string;
      email: string;
      name: string;
    };
    const user = await this.authService.findOrCreateGoogleUser(profile);
    const token = this.authService.signToken(user.id);
    this.authService.setSessionCookie(res, token);

    const frontendUrl = this.config.get<string>(
      'FRONTEND_URL',
      'http://localhost:3000',
    );
    res.redirect(`${frontendUrl}/vocabulary`);
  }
}
