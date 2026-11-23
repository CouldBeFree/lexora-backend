import { Injectable } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Mastery, VocabCard } from '../cards/entities/vocab-card.entity';
import { WordReminder } from './entities/word-reminder.entity';
import { PushService } from './push.service';
import { ReminderItem, RemindersCron } from './reminders-cron';

@Injectable()
export class WordRemindersService extends RemindersCron {
  constructor(
    @InjectRepository(WordReminder)
    reminders: Repository<WordReminder>,
    @InjectRepository(VocabCard)
    private readonly words: Repository<VocabCard>,
    pushService: PushService,
  ) {
    super('words', reminders, pushService);
  }

  @Cron(CronExpression.EVERY_MINUTE)
  sendDueReminders(): Promise<void> {
    return this.sendDue();
  }

  // Quiz: only the word; the meaning is in the app behind the tap.
  // Words still being learned go first. Mastered ones come up only when every
  // learning word was sent recently, and a recent word only when nothing else is left.
  protected async pick(
    userId: string,
    exclude: string[],
  ): Promise<ReminderItem | null> {
    const word =
      (await this.randomWord(userId, exclude, true)) ??
      (await this.randomWord(userId, exclude, false)) ??
      (exclude.length ? await this.randomWord(userId, [], false) : null);
    if (!word) return null;
    return {
      id: word.id,
      payload: {
        title: word.word,
        body: 'Remember what it means? Tap to check.',
        url: `/vocabulary?open=${word.id}`,
        tag: 'word-reminder',
      },
    };
  }

  private randomWord(
    userId: string,
    exclude: string[],
    learningOnly: boolean,
  ): Promise<VocabCard | null> {
    const query = this.words
      .createQueryBuilder('w')
      .where('w.userId = :userId', { userId })
      .orderBy('RANDOM()')
      .limit(1);
    if (learningOnly) {
      query.andWhere('w.mastery = :mastery', { mastery: Mastery.LEARNING });
    }
    if (exclude.length) {
      query.andWhere('w.id NOT IN (:...exclude)', { exclude });
    }
    return query.getOne();
  }
}
