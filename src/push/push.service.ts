import {
  BadRequestException,
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { FindOptionsWhere, Repository } from 'typeorm';
import { sendNotification, setVapidDetails, WebPushError } from 'web-push';
import { PushSubscriptionEntity } from './entities/push-subscription.entity';
import { PhraseReminder } from './entities/phrase-reminder.entity';
import { WordReminder } from './entities/word-reminder.entity';
import { SubscribePushDto } from './dto/push-subscription.dto';
import {
  isValidTimeZone,
  nextReminderAt,
  REMINDER_TOPICS,
  ReminderSchedule,
  ReminderTopic,
} from './reminder-schedule';

export interface PushPayload {
  title: string;
  body: string;
  url: string; // opened when the notification is tapped
  tag?: string;
}

// Which reminders a device gets
export type ReminderTopics = Record<ReminderTopic, boolean>;

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
    private readonly phraseReminders: Repository<PhraseReminder>,
    @InjectRepository(WordReminder)
    private readonly wordReminders: Repository<WordReminder>,
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

  // Saves the device (re-assigning it if another account used it), switches the
  // reminders in `dto` on or off and starts / stops the user's schedules to match.
  // Returns which reminders this device gets now.
  async subscribe(
    userId: string,
    dto: SubscribePushDto,
  ): Promise<ReminderTopics> {
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
    if (previousOwner === userId) {
      // Reminders left out of the request stay as they are
      subscription.phrases = dto.phrases ?? subscription.phrases;
      subscription.words = dto.words ?? subscription.words;
    } else {
      // A new device (or a new account on it) gets only what it asks for. A request
      // without either flag comes from an app version that knew phrase reminders only
      subscription.phrases = dto.phrases ?? dto.words === undefined;
      subscription.words = dto.words ?? false;
    }
    Object.assign(subscription, { userId, p256dh: dto.p256dh, auth: dto.auth });
    await this.subscriptions.save(subscription);
    if (previousOwner && previousOwner !== userId) {
      await this.removeUnusedSchedules(previousOwner);
    }

    for (const topic of REMINDER_TOPICS) {
      if (subscription[topic]) {
        await this.startSchedule(userId, topic, dto.timezone);
      } else {
        await this.removeScheduleIfUnused(userId, topic);
      }
    }
    return { phrases: subscription.phrases, words: subscription.words };
  }

  async unsubscribe(userId: string, endpoint: string): Promise<void> {
    await this.subscriptions.delete({ userId, endpoint });
    await this.removeUnusedSchedules(userId);
  }

  // Whether any device of the user has `topic` reminders on
  hasSubscriptions(userId: string, topic: ReminderTopic): Promise<boolean> {
    return this.subscriptions.exists({ where: withTopic(userId, topic) });
  }

  // Sends to the user's devices that have `topic` reminders on; drops subscriptions
  // the push service has expired
  async sendToUser(
    userId: string,
    topic: ReminderTopic,
    payload: PushPayload,
  ): Promise<void> {
    const devices = await this.subscriptions.find({
      where: withTopic(userId, topic),
    });
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

  private schedules(topic: ReminderTopic): Repository<ReminderSchedule> {
    return topic === 'phrases' ? this.phraseReminders : this.wordReminders;
  }

  // Creates the user's `topic` schedule if there is none, or moves it to a new time zone
  private async startSchedule(
    userId: string,
    topic: ReminderTopic,
    timezone: string,
  ): Promise<void> {
    const schedules = this.schedules(topic);
    const schedule = await schedules.findOne({ where: { userId } });
    if (!schedule) {
      await schedules.save(
        schedules.create({
          userId,
          timezone,
          nextAt: nextReminderAt(new Date(), timezone),
          recentIds: [],
        }),
      );
    } else if (schedule.timezone !== timezone) {
      await schedules.update(
        { userId },
        { timezone, nextAt: nextReminderAt(new Date(), timezone) },
      );
    }
  }

  private async removeScheduleIfUnused(
    userId: string,
    topic: ReminderTopic,
  ): Promise<void> {
    if (!(await this.hasSubscriptions(userId, topic))) {
      await this.schedules(topic).delete({ userId });
    }
  }

  private async removeUnusedSchedules(userId: string): Promise<void> {
    for (const topic of REMINDER_TOPICS) {
      await this.removeScheduleIfUnused(userId, topic);
    }
  }
}

// The user's devices that have `topic` reminders on
function withTopic(
  userId: string,
  topic: ReminderTopic,
): FindOptionsWhere<PushSubscriptionEntity> {
  return topic === 'phrases'
    ? { userId, phrases: true }
    : { userId, words: true };
}
