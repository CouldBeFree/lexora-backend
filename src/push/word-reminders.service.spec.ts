import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { WordRemindersService } from './word-reminders.service';
import { PushService } from './push.service';
import { WordReminder } from './entities/word-reminder.entity';
import { Mastery, VocabCard } from '../cards/entities/vocab-card.entity';

// Scheduling (late reminders, slots, no devices) is shared with phrase reminders
// and covered in phrase-reminders.service.spec.ts; this covers picking words.
const USER = '11111111-1111-4111-8111-111111111111';
const DUE = '2026-10-27T08:00:30Z';

describe('WordRemindersService', () => {
  let service: WordRemindersService;
  let reminder: WordReminder;
  let words: VocabCard[];
  let reminders: { find: jest.Mock; update: jest.Mock; delete: jest.Mock };
  let push: {
    enabled: boolean;
    hasSubscriptions: jest.Mock;
    sendToUser: jest.Mock;
  };

  const word = (id: string, mastery: Mastery) =>
    ({ id, word: `word-${id}`, mastery }) as VocabCard;

  beforeEach(async () => {
    reminder = {
      userId: USER,
      timezone: 'Europe/Kyiv',
      nextAt: new Date('2026-10-27T08:00:00Z'),
      recentIds: [],
    } as unknown as WordReminder;
    words = [];

    reminders = {
      find: jest.fn(() => Promise.resolve([reminder])),
      update: jest.fn(() => Promise.resolve()),
      delete: jest.fn(() => Promise.resolve()),
    };
    push = {
      enabled: true,
      hasSubscriptions: jest.fn(() => Promise.resolve(true)),
      sendToUser: jest.fn(() => Promise.resolve()),
    };

    // Minimal query builder: honours the mastery and NOT IN filters, "random" = first match
    const queryBuilder = () => {
      const filters: ((w: VocabCard) => boolean)[] = [];
      const qb = {
        where: () => qb,
        orderBy: () => qb,
        limit: () => qb,
        andWhere: (
          _: string,
          params: { mastery?: Mastery; exclude?: string[] },
        ) => {
          const { mastery, exclude } = params;
          if (mastery) filters.push((w) => w.mastery === mastery);
          if (exclude) filters.push((w) => !exclude.includes(w.id));
          return qb;
        },
        getOne: () =>
          Promise.resolve(
            words.find((w) => filters.every((f) => f(w))) ?? null,
          ),
      };
      return qb;
    };

    const moduleRef = await Test.createTestingModule({
      providers: [
        WordRemindersService,
        { provide: PushService, useValue: push },
        { provide: getRepositoryToken(WordReminder), useValue: reminders },
        {
          provide: getRepositoryToken(VocabCard),
          useValue: { createQueryBuilder: queryBuilder },
        },
      ],
    }).compile();
    service = moduleRef.get(WordRemindersService);
  });

  afterEach(() => jest.useRealTimers());

  const run = () => {
    jest.useFakeTimers({ now: new Date(DUE) });
    return service.sendDueReminders();
  };
  const sentTitle = () =>
    (push.sendToUser.mock.calls[0] as [string, string, { title: string }])[2]
      .title;

  it('sends a quiz for the word to devices with word reminders on', async () => {
    words = [word('w1', Mastery.LEARNING)];
    await run();

    expect(push.sendToUser).toHaveBeenCalledWith(USER, 'words', {
      title: 'word-w1',
      body: 'Remember what it means? Tap to check.',
      url: '/vocabulary?open=w1',
      tag: 'word-reminder',
    });
    expect(reminders.update).toHaveBeenCalledWith(
      { userId: USER },
      expect.objectContaining({ recentIds: ['w1'] }),
    );
  });

  it('prefers words that are still being learned', async () => {
    words = [word('m1', Mastery.MASTERED), word('l1', Mastery.LEARNING)];
    await run();

    expect(sentTitle()).toBe('word-l1');
  });

  it('falls back to a mastered word when the learning ones were sent recently', async () => {
    words = [word('l1', Mastery.LEARNING), word('m1', Mastery.MASTERED)];
    reminder.recentIds = ['l1'];
    await run();

    expect(sentTitle()).toBe('word-m1');
  });

  it('repeats a recent word when there is nothing else', async () => {
    words = [word('l1', Mastery.LEARNING)];
    reminder.recentIds = ['l1'];
    await run();

    expect(sentTitle()).toBe('word-l1');
  });

  it('keeps the schedule but sends nothing when the user has no words', async () => {
    await run();

    expect(push.sendToUser).not.toHaveBeenCalled();
    expect(reminders.update).toHaveBeenCalled();
  });

  it('drops the schedule once no device has word reminders on', async () => {
    push.hasSubscriptions.mockResolvedValue(false);
    await run();

    expect(push.hasSubscriptions).toHaveBeenCalledWith(USER, 'words');
    expect(reminders.delete).toHaveBeenCalledWith({ userId: USER });
    expect(push.sendToUser).not.toHaveBeenCalled();
  });
});
