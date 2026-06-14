import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PracticeError } from './entities/practice-error.entity';
import { VocabCard } from '../cards/entities/vocab-card.entity';
import { PracticeAiService, Mode3CheckResult } from './practice-ai.service';
import { SaveErrorDto } from './dto/errors.dto';

@Injectable()
export class PracticeErrorsService {
  constructor(
    @InjectRepository(PracticeError)
    private readonly errorsRepo: Repository<PracticeError>,
    @InjectRepository(VocabCard)
    private readonly cardRepo: Repository<VocabCard>,
    private readonly aiService: PracticeAiService,
  ) {}

  async saveError(userId: string, dto: SaveErrorDto): Promise<PracticeError> {
    const card = await this.cardRepo.findOne({
      where: { id: dto.wordId, userId },
    });
    if (!card) throw new NotFoundException({ message: 'Card not found' });

    const record = this.errorsRepo.create({
      userId,
      wordId: dto.wordId,
      originalSentence: dto.originalSentence,
      grammarFeedback: dto.grammarFeedback,
      resolvedSentence: null,
      resolvedFeedback: null,
      resolved: false,
    });
    return this.errorsRepo.save(record);
  }

  async getErrors(userId: string) {
    const errors = await this.errorsRepo.find({
      where: { userId, resolved: false },
      relations: { card: true },
      order: { createdAt: 'DESC' },
    });

    return errors.map((e) => ({
      id: e.id,
      userId: e.userId,
      wordId: e.wordId,
      word: e.card.word,
      pos: e.card.pos,
      originalSentence: e.originalSentence,
      grammarFeedback: e.grammarFeedback,
      resolvedSentence: e.resolvedSentence,
      resolvedFeedback: e.resolvedFeedback,
      resolved: e.resolved,
      createdAt: e.createdAt,
      updatedAt: e.updatedAt,
    }));
  }

  async checkError(
    userId: string,
    id: string,
    sentence: string,
  ): Promise<Mode3CheckResult> {
    const error = await this.errorsRepo.findOne({
      where: { id, userId },
      relations: { card: true },
    });
    if (!error) throw new NotFoundException({ message: 'Error record not found' });

    const result = await this.aiService.checkMode3(error.card, sentence);

    error.resolvedSentence = sentence;
    error.resolvedFeedback = result.grammarFeedback;
    await this.errorsRepo.save(error);

    return result;
  }

  async resolveError(
    userId: string,
    id: string,
  ): Promise<{ id: string; resolved: boolean; updatedAt: Date }> {
    const error = await this.errorsRepo.findOne({ where: { id, userId } });
    if (!error) throw new NotFoundException({ message: 'Error record not found' });

    error.resolved = true;
    const saved = await this.errorsRepo.save(error);

    return { id: saved.id, resolved: saved.resolved, updatedAt: saved.updatedAt };
  }
}
