import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PhraseCard } from './entities/phrase-card.entity';
import { PhraseSentenceEntity } from './entities/phrase-sentence.entity';
import { PhrasesAiService, PhraseDetails } from './phrases-ai.service';
import { CreatePhraseDto } from './dto/create-phrase.dto';
import { UpdatePhraseDto } from './dto/update-phrase.dto';

export interface PhraseSentence {
  id: string;
  sentence: string;
  createdAt: Date;
}

export interface PhraseWithExamples extends PhraseCard {
  examples: PhraseSentence[];
}

@Injectable()
export class PhrasesService {
  private readonly logger = new Logger(PhrasesService.name);

  constructor(
    @InjectRepository(PhraseCard)
    private readonly repo: Repository<PhraseCard>,
    @InjectRepository(PhraseSentenceEntity)
    private readonly sentencesRepo: Repository<PhraseSentenceEntity>,
    private readonly aiService: PhrasesAiService,
  ) {}

  async findAll(userId: string): Promise<PhraseWithExamples[]> {
    const [cards, sentences] = await Promise.all([
      this.repo.find({ where: { userId }, order: { addedAt: 'DESC' } }),
      this.sentencesRepo.find({
        where: { userId },
        order: { createdAt: 'DESC' },
      }),
    ]);

    const byPhraseId = new Map<string, PhraseSentence[]>();
    for (const e of sentences) {
      const list = byPhraseId.get(e.phraseId) ?? [];
      list.push(this.toSentence(e));
      byPhraseId.set(e.phraseId, list);
    }

    return cards.map((card) => ({
      ...card,
      examples: byPhraseId.get(card.id) ?? [],
    }));
  }

  async findOne(id: string, userId: string): Promise<PhraseWithExamples> {
    const card = await this.findEntity(id, userId);
    const examples = await this.findSentences(id, userId);
    return { ...card, examples };
  }

  async create(
    userId: string,
    dto: CreatePhraseDto,
  ): Promise<PhraseWithExamples> {
    const phrase = dto.phrase.trim();
    if (!phrase) {
      throw new BadRequestException({ message: 'phrase should not be empty' });
    }

    // AI failure must not block creation — the user can retry via POST /phrases/:id/generate
    let details: PhraseDetails | null = null;
    try {
      details = await this.aiService.generateDetails(phrase);
    } catch (err) {
      if (!(err instanceof ServiceUnavailableException)) throw err;
      this.logger.warn(`AI details failed for "${phrase}": ${err.message}`);
    }

    const card = await this.repo.save(
      this.repo.create({
        userId,
        phrase,
        explanation: details?.explanation ?? '',
      }),
    );
    if (details) await this.saveSentence(card.id, userId, details.example);

    return this.findOne(card.id, userId);
  }

  async update(
    id: string,
    userId: string,
    dto: UpdatePhraseDto,
  ): Promise<PhraseWithExamples> {
    if (dto.phrase === undefined && dto.explanation === undefined) {
      throw new BadRequestException({ message: 'No valid fields to update' });
    }

    const card = await this.findEntity(id, userId);
    if (dto.phrase !== undefined) {
      const phrase = dto.phrase.trim();
      if (!phrase) {
        throw new BadRequestException({
          message: 'phrase should not be empty',
        });
      }
      card.phrase = phrase;
    }
    if (dto.explanation !== undefined) card.explanation = dto.explanation;

    await this.repo.save(card);
    return this.findOne(id, userId);
  }

  async remove(id: string, userId: string): Promise<void> {
    const card = await this.findEntity(id, userId);
    await this.repo.remove(card);
  }

  // Overwrites the explanation and adds 1 new example
  async generateDetails(
    id: string,
    userId: string,
  ): Promise<PhraseWithExamples> {
    const card = await this.findEntity(id, userId);
    const details = await this.aiService.generateDetails(card.phrase);

    card.explanation = details.explanation;
    await this.repo.save(card);
    await this.saveSentence(card.id, userId, details.example);

    return this.findOne(id, userId);
  }

  async getSentences(id: string, userId: string): Promise<PhraseSentence[]> {
    await this.findEntity(id, userId);
    return this.findSentences(id, userId);
  }

  // Generates 1 new example; returns only the new row
  async generateSentence(
    id: string,
    userId: string,
  ): Promise<PhraseSentence[]> {
    const card = await this.findEntity(id, userId);
    const existing = await this.findSentences(id, userId);
    const sentence = await this.aiService.generateExample(
      card,
      existing.map((s) => s.sentence),
    );
    const saved = await this.saveSentence(id, userId, sentence);
    return [this.toSentence(saved)];
  }

  private async findEntity(id: string, userId: string): Promise<PhraseCard> {
    const card = await this.repo.findOne({ where: { id, userId } });
    if (!card) throw new NotFoundException({ message: 'Phrase not found' });
    return card;
  }

  private async findSentences(
    phraseId: string,
    userId: string,
  ): Promise<PhraseSentence[]> {
    const rows = await this.sentencesRepo.find({
      where: { phraseId, userId },
      order: { createdAt: 'DESC' },
    });
    return rows.map((e) => this.toSentence(e));
  }

  private saveSentence(
    phraseId: string,
    userId: string,
    sentence: string,
  ): Promise<PhraseSentenceEntity> {
    return this.sentencesRepo.save(
      this.sentencesRepo.create({ phraseId, userId, sentence }),
    );
  }

  private toSentence(e: PhraseSentenceEntity): PhraseSentence {
    return { id: e.id, sentence: e.sentence, createdAt: e.createdAt };
  }
}
