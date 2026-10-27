import {
  Body,
  Controller,
  Delete,
  Get,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PushService } from './push.service';
import {
  SubscribePushDto,
  UnsubscribePushDto,
} from './dto/push-subscription.dto';

@Controller('push')
@UseGuards(JwtAuthGuard) // all push routes require a valid session
export class PushController {
  constructor(private readonly pushService: PushService) {}

  // GET /push/public-key — VAPID key the browser subscribes with; 503 if not configured
  @Get('public-key')
  getPublicKey() {
    return { publicKey: this.pushService.getPublicKey() };
  }

  // POST /push/subscriptions — saves this device and starts phrase reminders
  @Post('subscriptions')
  async subscribe(@Req() req: Request, @Body() dto: SubscribePushDto) {
    const { id } = req.user as { id: string };
    await this.pushService.subscribe(id, dto);
    return { ok: true };
  }

  // DELETE /push/subscriptions — removes this device; reminders stop with the last one
  @Delete('subscriptions')
  async unsubscribe(@Req() req: Request, @Body() dto: UnsubscribePushDto) {
    const { id } = req.user as { id: string };
    await this.pushService.unsubscribe(id, dto.endpoint);
    return { ok: true };
  }
}
