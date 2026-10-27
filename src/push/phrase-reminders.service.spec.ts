import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { PhraseRemindersService } from './phrase-reminders.service';
import { PushService } from './push.service';
import { PhraseReminder } from './entities/phrase-reminder.entity';
import { PhraseCard } from '../phrases/entities/phrase-card.entity';

const USER = '11111111-1111-4111-8111-111111111111';
const TZ = 'Europe/Kyiv'; // UTC+2 on these dates

describe('PhraseRemindersService', () => {
  let service: PhraseRemindersService;
  let reminder: PhraseReminder;
  let phrases: PhraseCard[];
  let reminders: { find: jest.Mock; update: jest.Mock; delete: jest.Mock };
  let push: {
    enabled: boolean;
    hasSubscriptions: jest.Mock;
    sendToUser: jest.Mock;
  };

  beforeEach(async () => {
    reminder = {
      userId: USER,
      timezone: TZ,
      nextAt: new Date('2026-10-27T08:00:00Z'), // 10:00 local, first slot
      recentPhraseIds: [],
    } as unknown as PhraseReminder;
    phrases = [
      { id: 'p1', phrase: 'to lay eyes on' },
      { id: 'p2', phrase: 'to break the ice' },
    ] as PhraseCard[];

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

    // Minimal query builder: honours the NOT IN exclusion, "random" = first match
    const queryBuilder = (exclude: string[] = []) => {
      const qb = {
        where: () => qb,
        orderBy: () => qb,
        limit: () => qb,
        clone: () => queryBuilder(exclude),
        andWhere: (_: string, params: { exclude: string[] }) =>
          queryBuilder(params.exclude),
        getOne: () =>
          Promise.resolve(phrases.find((p) => !exclude.includes(p.id)) ?? null),
      };
      return qb;
    };
    const phrasesRepo = { createQueryBuilder: () => queryBuilder() };

    const moduleRef = await Test.createTestingModule({
      providers: [
        PhraseRemindersService,
        { provide: PushService, useValue: push },
        { provide: getRepositoryToken(PhraseReminder), useValue: reminders },
        { provide: getRepositoryToken(PhraseCard), useValue: phrasesRepo },
      ],
    }).compile();
    service = moduleRef.get(PhraseRemindersService);
  });

  afterEach(() => jest.useRealTimers());

  const runAt = (iso: string) => {
    jest.useFakeTimers({ now: new Date(iso) });
    return service.sendDueReminders();
  };

  it('sends a quiz for a random phrase and schedules the next slot', async () => {
    await runAt('2026-10-27T08:00:30Z');

    expect(push.sendToUser).toHaveBeenCalledWith(USER, {
      title: 'to lay eyes on',
      body: 'Remember what it means? Tap to check.',
      url: '/phrases?open=p1',
      tag: 'phrase-reminder',
    });
    const [, changes] = reminders.update.mock.calls[0] as [
      unknown,
      { nextAt: Date; recentPhraseIds: string[] },
    ];
    expect(changes.recentPhraseIds).toEqual(['p1']);
    // Next one lands in the 12:40–17:20 local slot
    expect(changes.nextAt.getTime()).toBeGreaterThanOrEqual(
      Date.parse('2026-10-27T10:40:00Z'),
    );
    expect(changes.nextAt.getTime()).toBeLessThan(
      Date.parse('2026-10-27T15:20:00Z'),
    );
  });

  it('skips recently sent phrases while others are left', async () => {
    reminder.recentPhraseIds = ['p1'];
    await runAt('2026-10-27T08:00:30Z');

    expect(push.sendToUser).toHaveBeenCalledWith(
      USER,
      expect.objectContaining({ title: 'to break the ice' }),
    );
    expect(reminders.update).toHaveBeenCalledWith(
      { userId: USER },
      expect.objectContaining({ recentPhraseIds: ['p2', 'p1'] }),
    );
  });

  it('falls back to a recent phrase when there is nothing else', async () => {
    reminder.recentPhraseIds = ['p1', 'p2'];
    phrases = phrases.slice(0, 1);
    await runAt('2026-10-27T08:00:30Z');

    // The exclusion found nothing, so the fallback query returns p1 again
    expect(push.sendToUser).toHaveBeenCalledTimes(1);
  });

  it('skips a reminder that is too late and reschedules from now', async () => {
    // Due at 10:00 local, the API comes back at 23:00 local
    await runAt('2026-10-27T21:00:00Z');

    expect(push.sendToUser).not.toHaveBeenCalled();
    const [, changes] = reminders.update.mock.calls[0] as [
      unknown,
      { nextAt: Date },
    ];
    // Tomorrow's 08:00–12:40 local slot
    expect(changes.nextAt.getTime()).toBeGreaterThanOrEqual(
      Date.parse('2026-10-28T06:00:00Z'),
    );
    expect(changes.nextAt.getTime()).toBeLessThan(
      Date.parse('2026-10-28T10:40:00Z'),
    );
  });

  it('keeps the schedule but sends nothing when the user has no phrases', async () => {
    phrases = [];
    await runAt('2026-10-27T08:00:30Z');

    expect(push.sendToUser).not.toHaveBeenCalled();
    expect(reminders.update).toHaveBeenCalled();
  });

  it('drops the schedule once the user has no devices left', async () => {
    push.hasSubscriptions.mockResolvedValue(false);
    await runAt('2026-10-27T08:00:30Z');

    expect(reminders.delete).toHaveBeenCalledWith({ userId: USER });
    expect(push.sendToUser).not.toHaveBeenCalled();
    expect(reminders.update).not.toHaveBeenCalled();
  });

  it('does nothing when push is not configured', async () => {
    push.enabled = false;
    await runAt('2026-10-27T08:00:30Z');

    expect(reminders.find).not.toHaveBeenCalled();
  });
});
