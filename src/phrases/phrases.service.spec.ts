import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import {
  BadRequestException,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { PhrasesService } from './phrases.service';
import { PhrasesAiService } from './phrases-ai.service';
import { PhraseCard } from './entities/phrase-card.entity';
import { PhraseSentenceEntity } from './entities/phrase-sentence.entity';

const USER = '11111111-1111-4111-8111-111111111111';
const PHRASE_ID = '22222222-2222-4222-8222-222222222222';

describe('PhrasesService', () => {
  let service: PhrasesService;
  let cards: PhraseCard[];
  let sentences: PhraseSentenceEntity[];
  let ai: { generateDetails: jest.Mock; generateExample: jest.Mock };

  beforeEach(async () => {
    cards = [];
    sentences = [];
    let seq = 0;

    const repo = {
      create: (data: Partial<PhraseCard>) => ({ ...data }) as PhraseCard,
      save: jest.fn((card: PhraseCard) => {
        if (!card.id) {
          card.id = PHRASE_ID;
          card.addedAt = new Date();
          cards.push(card);
        }
        return Promise.resolve(card);
      }),
      findOne: ({ where }: { where: { id: string; userId: string } }) =>
        Promise.resolve(
          cards.find((c) => c.id === where.id && c.userId === where.userId) ??
            null,
        ),
      find: () => Promise.resolve(cards),
      remove: jest.fn(),
    };
    const sentencesRepo = {
      create: (data: Partial<PhraseSentenceEntity>) =>
        ({ ...data }) as PhraseSentenceEntity,
      save: (e: PhraseSentenceEntity) => {
        e.id = `s${++seq}`;
        e.createdAt = new Date(Date.now() + seq);
        sentences.unshift(e);
        return Promise.resolve(e);
      },
      find: ({ where }: { where: { phraseId?: string } }) =>
        Promise.resolve(
          sentences.filter(
            (s) => !where.phraseId || s.phraseId === where.phraseId,
          ),
        ),
    };
    ai = { generateDetails: jest.fn(), generateExample: jest.fn() };

    const moduleRef = await Test.createTestingModule({
      providers: [
        PhrasesService,
        { provide: getRepositoryToken(PhraseCard), useValue: repo },
        {
          provide: getRepositoryToken(PhraseSentenceEntity),
          useValue: sentencesRepo,
        },
        { provide: PhrasesAiService, useValue: ai },
      ],
    }).compile();

    service = moduleRef.get(PhrasesService);
  });

  it('create fills explanation and 1 example from AI', async () => {
    ai.generateDetails.mockResolvedValue({
      explanation: 'To see someone or something for the first time.',
      example: 'The moment I laid eyes on her, I knew.',
    });

    const result = await service.create(USER, {
      phrase: '  to lay eyes on  ',
    });

    expect(ai.generateDetails).toHaveBeenCalledWith('to lay eyes on');
    expect(result.phrase).toBe('to lay eyes on');
    expect(result.explanation).toBe(
      'To see someone or something for the first time.',
    );
    expect(result.examples.map((e) => e.sentence)).toEqual([
      'The moment I laid eyes on her, I knew.',
    ]);
  });

  it('create still saves the phrase when AI is unavailable', async () => {
    ai.generateDetails.mockRejectedValue(
      new ServiceUnavailableException({ message: 'AI service error' }),
    );

    const result = await service.create(USER, { phrase: 'to lay eyes on' });

    expect(result.phrase).toBe('to lay eyes on');
    expect(result.explanation).toBe('');
    expect(result.examples).toEqual([]);
  });

  it('create does not swallow non-AI errors', async () => {
    ai.generateDetails.mockRejectedValue(new Error('boom'));
    await expect(
      service.create(USER, { phrase: 'to lay eyes on' }),
    ).rejects.toThrow('boom');
    expect(cards).toHaveLength(0);
  });

  it('create rejects a whitespace-only phrase', async () => {
    await expect(service.create(USER, { phrase: '   ' })).rejects.toThrow(
      BadRequestException,
    );
    expect(ai.generateDetails).not.toHaveBeenCalled();
  });

  it('generateDetails overwrites explanation and adds an example', async () => {
    ai.generateDetails.mockRejectedValueOnce(
      new ServiceUnavailableException({ message: 'AI service error' }),
    );
    await service.create(USER, { phrase: 'to lay eyes on' });

    ai.generateDetails.mockResolvedValue({
      explanation: 'To see for the first time.',
      example: 'She had never laid eyes on the sea.',
    });
    const result = await service.generateDetails(PHRASE_ID, USER);

    expect(result.explanation).toBe('To see for the first time.');
    expect(result.examples).toHaveLength(1);
  });

  it('generateSentence passes existing examples and returns only the new one', async () => {
    ai.generateDetails.mockResolvedValue({
      explanation: 'To see for the first time.',
      example: 'First example.',
    });
    await service.create(USER, { phrase: 'to lay eyes on' });
    ai.generateExample.mockResolvedValue('Second example.');

    const result = await service.generateSentence(PHRASE_ID, USER);

    expect(ai.generateExample).toHaveBeenCalledWith(
      expect.objectContaining({ phrase: 'to lay eyes on' }),
      ['First example.'],
    );
    expect(result.map((s) => s.sentence)).toEqual(['Second example.']);
    expect(
      (await service.getSentences(PHRASE_ID, USER)).map((s) => s.sentence),
    ).toEqual(['Second example.', 'First example.']);
  });

  it('update requires at least one field', async () => {
    await expect(service.update(PHRASE_ID, USER, {})).rejects.toThrow(
      BadRequestException,
    );
  });

  it("does not expose another user's phrase", async () => {
    ai.generateDetails.mockResolvedValue({ explanation: 'x', example: 'y' });
    await service.create(USER, { phrase: 'to lay eyes on' });

    await expect(
      service.findOne(PHRASE_ID, '33333333-3333-4333-8333-333333333333'),
    ).rejects.toThrow(NotFoundException);
  });
});
