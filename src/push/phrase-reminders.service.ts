import { Injectable } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PhraseCard } from '../phrases/entities/phrase-card.entity';
import { PhraseReminder } from './entities/phrase-reminder.entity';
import { PushService } from './push.service';
import { ReminderItem, RemindersCron } from './reminders-cron';

@Injectable()
export class PhraseRemindersService extends RemindersCron {
  constructor(
    @InjectRepository(PhraseReminder)
    reminders: Repository<PhraseReminder>,
    @InjectRepository(PhraseCard)
    private readonly phrases: Repository<PhraseCard>,
    pushService: PushService,
  ) {
    super('phrases', reminders, pushService);
  }

  @Cron(CronExpression.EVERY_MINUTE)
  sendDueReminders(): Promise<void> {
    return this.sendDue();
  }

  // Quiz: only the phrase; the meaning is in the app behind the tap
  protected async pick(
    userId: string,
    exclude: string[],
  ): Promise<ReminderItem | null> {
    const phrase = await this.randomPhrase(userId, exclude);
    if (!phrase) return null;
    return {
      id: phrase.id,
      payload: {
        title: phrase.phrase,
        body: 'Remember what it means? Tap to check.',
        url: `/phrases?open=${phrase.id}`,
        tag: 'phrase-reminder',
      },
    };
  }

  // Random phrase of the user, avoiding the recently sent ones when possible
  private async randomPhrase(
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
