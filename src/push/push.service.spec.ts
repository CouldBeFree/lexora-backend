import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { PushService } from './push.service';
import { PushSubscriptionEntity } from './entities/push-subscription.entity';
import { PhraseReminder } from './entities/phrase-reminder.entity';
import { WordReminder } from './entities/word-reminder.entity';
import { SubscribePushDto } from './dto/push-subscription.dto';

const USER = '11111111-1111-4111-8111-111111111111';
const OTHER = '22222222-2222-4222-8222-222222222222';
const ENDPOINT = 'https://fcm.googleapis.com/fcm/send/abc';
const TZ = 'Europe/Kyiv';

const scheduleRepo = () => ({
  findOne: jest.fn(() => Promise.resolve(null)),
  create: jest.fn((row: object) => row),
  save: jest.fn(() => Promise.resolve()),
  update: jest.fn(() => Promise.resolve()),
  delete: jest.fn(() => Promise.resolve()),
});

describe('PushService.subscribe', () => {
  let service: PushService;
  let existing: PushSubscriptionEntity | null;
  let subscriptions: {
    findOne: jest.Mock;
    create: jest.Mock;
    save: jest.Mock;
    exists: jest.Mock;
  };
  let phraseReminders: ReturnType<typeof scheduleRepo>;
  let wordReminders: ReturnType<typeof scheduleRepo>;

  beforeEach(async () => {
    jest.spyOn(Logger.prototype, 'warn').mockImplementation(); // VAPID_* unset
    existing = null;
    subscriptions = {
      findOne: jest.fn(() => Promise.resolve(existing)),
      create: jest.fn((row: object) => ({ ...row })),
      save: jest.fn(() => Promise.resolve()),
      // No other device has anything on
      exists: jest.fn(() => Promise.resolve(false)),
    };
    phraseReminders = scheduleRepo();
    wordReminders = scheduleRepo();

    const moduleRef = await Test.createTestingModule({
      providers: [
        PushService,
        { provide: ConfigService, useValue: { get: () => undefined } },
        {
          provide: getRepositoryToken(PushSubscriptionEntity),
          useValue: subscriptions,
        },
        {
          provide: getRepositoryToken(PhraseReminder),
          useValue: phraseReminders,
        },
        { provide: getRepositoryToken(WordReminder), useValue: wordReminders },
      ],
    }).compile();
    service = moduleRef.get(PushService);
  });

  afterEach(() => jest.restoreAllMocks());

  const subscribe = (userId: string, topics: Partial<SubscribePushDto> = {}) =>
    service.subscribe(userId, {
      endpoint: ENDPOINT,
      p256dh: 'key',
      auth: 'secret',
      timezone: TZ,
      ...topics,
    });

  it('gives a new device without flags phrase reminders (older app)', async () => {
    await expect(subscribe(USER)).resolves.toEqual({
      phrases: true,
      words: false,
    });

    expect(phraseReminders.save).toHaveBeenCalledWith(
      expect.objectContaining({ userId: USER, timezone: TZ, recentIds: [] }),
    );
    expect(wordReminders.save).not.toHaveBeenCalled();
  });

  it('gives a new device only the reminders it asks for', async () => {
    await expect(subscribe(USER, { words: true })).resolves.toEqual({
      phrases: false,
      words: true,
    });

    expect(wordReminders.save).toHaveBeenCalledWith(
      expect.objectContaining({ userId: USER, timezone: TZ }),
    );
    expect(phraseReminders.save).not.toHaveBeenCalled();
  });

  it('keeps the flags a request leaves out', async () => {
    existing = {
      endpoint: ENDPOINT,
      userId: USER,
      phrases: true,
      words: false,
    } as PushSubscriptionEntity;

    await expect(subscribe(USER, { words: true })).resolves.toEqual({
      phrases: true,
      words: true,
    });
    await expect(subscribe(USER)).resolves.toEqual({
      phrases: true,
      words: true,
    });
  });

  it('drops a schedule switched off on the last device that had it', async () => {
    existing = {
      endpoint: ENDPOINT,
      userId: USER,
      phrases: true,
      words: true,
    } as PushSubscriptionEntity;

    await expect(subscribe(USER, { words: false })).resolves.toEqual({
      phrases: true,
      words: false,
    });
    expect(wordReminders.delete).toHaveBeenCalledWith({ userId: USER });
    expect(phraseReminders.delete).not.toHaveBeenCalled();
  });

  it('resets the flags of a device that moves to another account', async () => {
    existing = {
      endpoint: ENDPOINT,
      userId: OTHER,
      phrases: true,
      words: true,
    } as PushSubscriptionEntity;

    await expect(subscribe(USER, { words: true })).resolves.toEqual({
      phrases: false,
      words: true,
    });
    // The previous owner has no devices left, so both of their schedules go
    expect(phraseReminders.delete).toHaveBeenCalledWith({ userId: OTHER });
    expect(wordReminders.delete).toHaveBeenCalledWith({ userId: OTHER });
  });
});
