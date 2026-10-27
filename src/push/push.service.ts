import {
  BadRequestException,
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { sendNotification, setVapidDetails, WebPushError } from 'web-push';
import { PushSubscriptionEntity } from './entities/push-subscription.entity';
import { PhraseReminder } from './entities/phrase-reminder.entity';
import { SubscribePushDto } from './dto/push-subscription.dto';
import { isValidTimeZone, nextReminderAt } from './reminder-schedule';

export interface PushPayload {
  title: string;
  body: string;
  url: string; // opened when the notification is tapped
  tag?: string;
}

// The server POSTs to subscription endpoints, so only browser push services are accepted
const PUSH_HOSTS = [
  'fcm.googleapis.com', // Chrome, Android, Samsung Internet
  'push.services.mozilla.com', // Firefox
  'notify.windows.com', // Edge
  'push.apple.com', // Safari, iOS home-screen apps
];

export function isPushServiceUrl(endpoint: string): boolean {
  try {
    const url = new URL(endpoint);
    return (
      url.protocol === 'https:' &&
      PUSH_HOSTS.some(
        (host) => url.hostname === host || url.hostname.endsWith(`.${host}`),
      )
    );
  } catch {
    return false;
  }
}

// Undelivered reminders are dropped after this long — a stale quiz is noise
const TTL_SECONDS = 30 * 60;

@Injectable()
export class PushService {
  private readonly logger = new Logger(PushService.name);
  private readonly publicKey: string | null = null;

  constructor(
    config: ConfigService,
    @InjectRepository(PushSubscriptionEntity)
    private readonly subscriptions: Repository<PushSubscriptionEntity>,
    @InjectRepository(PhraseReminder)
    private readonly reminders: Repository<PhraseReminder>,
  ) {
    const publicKey = config.get<string>('VAPID_PUBLIC_KEY');
    const privateKey = config.get<string>('VAPID_PRIVATE_KEY');
    const subject = config.get<string>('VAPID_SUBJECT');
    if (publicKey && privateKey && subject) {
      setVapidDetails(subject, publicKey, privateKey);
      this.publicKey = publicKey;
    } else {
      this.logger.warn('VAPID_* not set — push notifications are disabled');
    }
  }

  get enabled(): boolean {
    return this.publicKey !== null;
  }

  getPublicKey(): string {
    if (!this.publicKey) {
      throw new ServiceUnavailableException(
        'Push notifications are not configured',
      );
    }
    return this.publicKey;
  }

  // Saves the device (re-assigning it if another account used it) and
  // starts the user's reminder schedule if there is none yet
  async subscribe(userId: string, dto: SubscribePushDto): Promise<void> {
    if (!isPushServiceUrl(dto.endpoint)) {
      throw new BadRequestException('Unsupported push service');
    }
    if (!isValidTimeZone(dto.timezone)) {
      throw new BadRequestException('Invalid timezone');
    }

    const existing = await this.subscriptions.findOne({
      where: { endpoint: dto.endpoint },
    });
    const subscription =
      existing ?? this.subscriptions.create({ endpoint: dto.endpoint });
    const previousOwner = existing?.userId;
    Object.assign(subscription, { userId, p256dh: dto.p256dh, auth: dto.auth });
    await this.subscriptions.save(subscription);
    if (previousOwner && previousOwner !== userId) {
      await this.removeReminderIfUnused(previousOwner);
    }

    const reminder = await this.reminders.findOne({ where: { userId } });
    if (!reminder) {
      await this.reminders.save(
        this.reminders.create({
          userId,
          timezone: dto.timezone,
          nextAt: nextReminderAt(new Date(), dto.timezone),
          recentPhraseIds: [],
        }),
      );
    } else if (reminder.timezone !== dto.timezone) {
      await this.reminders.update(
        { userId },
        {
          timezone: dto.timezone,
          nextAt: nextReminderAt(new Date(), dto.timezone),
        },
      );
    }
  }

  async unsubscribe(userId: string, endpoint: string): Promise<void> {
    await this.subscriptions.delete({ userId, endpoint });
    await this.removeReminderIfUnused(userId);
  }

  hasSubscriptions(userId: string): Promise<boolean> {
    return this.subscriptions.exists({ where: { userId } });
  }

  // Sends to every device of the user; drops subscriptions the push service has expired
  async sendToUser(userId: string, payload: PushPayload): Promise<void> {
    const devices = await this.subscriptions.find({ where: { userId } });
    const body = JSON.stringify(payload);

    await Promise.all(
      devices.map(async (device) => {
        try {
          await sendNotification(
            {
              endpoint: device.endpoint,
              keys: { p256dh: device.p256dh, auth: device.auth },
            },
            body,
            { TTL: TTL_SECONDS },
          );
        } catch (err) {
          if (
            err instanceof WebPushError &&
            [404, 410].includes(err.statusCode)
          ) {
            await this.subscriptions.delete({ id: device.id });
          } else {
            this.logger.warn(
              `Push to ${new URL(device.endpoint).host} failed: ${(err as Error).message}`,
            );
          }
        }
      }),
    );
  }

  private async removeReminderIfUnused(userId: string): Promise<void> {
    if (!(await this.hasSubscriptions(userId))) {
      await this.reminders.delete({ userId });
    }
  }
}
