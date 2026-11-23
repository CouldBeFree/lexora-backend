import { Logger } from '@nestjs/common';
import { LessThanOrEqual, Repository } from 'typeorm';
import { PushPayload, PushService } from './push.service';
import {
  nextReminderAt,
  REMINDERS_PER_DAY,
  ReminderSchedule,
  ReminderTopic,
} from './reminder-schedule';

// A reminder this overdue (e.g. the API was down) is skipped rather than sent late
const MAX_DELAY_MS = 10 * 60 * 1000;

// What a reminder shows; `id` is remembered so the next ones avoid repeating it
export interface ReminderItem {
  id: string;
  payload: PushPayload;
}

// Sending logic shared by phrase and word reminders. Each subclass runs `sendDue`
// from its own every-minute cron and decides only what to send (`pick`).
export abstract class RemindersCron {
  private readonly logger = new Logger(this.constructor.name);
  private running = false;

  constructor(
    private readonly topic: ReminderTopic,
    private readonly reminders: Repository<ReminderSchedule>,
    private readonly pushService: PushService,
  ) {}

  // A random item of the user, avoiding `exclude` (recently sent) when possible
  protected abstract pick(
    userId: string,
    exclude: string[],
  ): Promise<ReminderItem | null>;

  protected async sendDue(): Promise<void> {
    if (this.running || !this.pushService.enabled) return;
    this.running = true;
    try {
      const now = new Date();
      const due = await this.reminders.find({
        where: { nextAt: LessThanOrEqual(now) },
      });
      for (const reminder of due) {
        try {
          await this.handle(reminder, now);
        } catch (err) {
          this.logger.error(
            `Reminder for ${reminder.userId} failed: ${(err as Error).message}`,
          );
        }
      }
    } finally {
      this.running = false;
    }
  }

  private async handle(reminder: ReminderSchedule, now: Date): Promise<void> {
    const { userId } = reminder;
    if (!(await this.pushService.hasSubscriptions(userId, this.topic))) {
      await this.reminders.delete({ userId });
      return;
    }

    let recentIds = reminder.recentIds;
    const late = now.getTime() - reminder.nextAt.getTime() > MAX_DELAY_MS;
    if (!late) {
      const item = await this.pick(userId, recentIds);
      if (item) {
        await this.pushService.sendToUser(userId, this.topic, item.payload);
        recentIds = [item.id, ...recentIds].slice(0, REMINDERS_PER_DAY - 1);
      }
    }

    await this.reminders.update(
      { userId },
      {
        nextAt: nextReminderAt(late ? now : reminder.nextAt, reminder.timezone),
        recentIds,
      },
    );
  }
}
