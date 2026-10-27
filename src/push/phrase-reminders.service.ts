import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { LessThanOrEqual, Repository } from 'typeorm';
import { PhraseCard } from '../phrases/entities/phrase-card.entity';
import { PhraseReminder } from './entities/phrase-reminder.entity';
import { PushService } from './push.service';
import { nextReminderAt, REMINDERS_PER_DAY } from './reminder-schedule';

// A reminder this overdue (e.g. the API was down) is skipped rather than sent late
const MAX_DELAY_MS = 10 * 60 * 1000;

@Injectable()
export class PhraseRemindersService {
  private readonly logger = new Logger(PhraseRemindersService.name);
  private running = false;

  constructor(
    @InjectRepository(PhraseReminder)
    private readonly reminders: Repository<PhraseReminder>,
    @InjectRepository(PhraseCard)
    private readonly phrases: Repository<PhraseCard>,
    private readonly pushService: PushService,
  ) {}

  @Cron(CronExpression.EVERY_MINUTE)
  async sendDueReminders(): Promise<void> {
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
            `Phrase reminder for ${reminder.userId} failed: ${(err as Error).message}`,
          );
        }
      }
    } finally {
      this.running = false;
    }
  }

  private async handle(reminder: PhraseReminder, now: Date): Promise<void> {
    const { userId } = reminder;
    if (!(await this.pushService.hasSubscriptions(userId))) {
      await this.reminders.delete({ userId });
      return;
    }

    let recentPhraseIds = reminder.recentPhraseIds;
    const late = now.getTime() - reminder.nextAt.getTime() > MAX_DELAY_MS;
    if (!late) {
      const phrase = await this.pickPhrase(userId, recentPhraseIds);
      if (phrase) {
        // Quiz: only the phrase; the meaning is in the app behind the tap
        await this.pushService.sendToUser(userId, {
          title: phrase.phrase,
          body: 'Remember what it means? Tap to check.',
          url: `/phrases?open=${phrase.id}`,
          tag: 'phrase-reminder',
        });
        recentPhraseIds = [phrase.id, ...recentPhraseIds].slice(
          0,
          REMINDERS_PER_DAY - 1,
        );
      }
    }

    await this.reminders.update(
      { userId },
      {
        nextAt: nextReminderAt(late ? now : reminder.nextAt, reminder.timezone),
        recentPhraseIds,
      },
    );
  }

  // Random phrase of the user, avoiding the recently sent ones when possible
  private async pickPhrase(
    userId: string,
    exclude: string[],
  ): Promise<PhraseCard | null> {
    const query = this.phrases
      .createQueryBuilder('p')
      .where('p.userId = :userId', { userId })
      .orderBy('RANDOM()')
      .limit(1);

    if (exclude.length) {
      const fresh = await query
        .clone()
        .andWhere('p.id NOT IN (:...exclude)', { exclude })
        .getOne();
      if (fresh) return fresh;
    }
    return query.getOne();
  }
}
