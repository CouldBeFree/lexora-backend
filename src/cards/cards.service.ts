import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { VocabCard } from './entities/vocab-card.entity';
import { WordProgress } from '../practice/entities/word-progress.entity';
import { CardSentencesService, CardSentence } from './card-sentences.service';
import { CreateCardDto } from './dto/create-card.dto';
import { UpdateCardDto } from './dto/update-card.dto';

export interface CardWithProgress extends Omit<VocabCard, 'example'> {
  example: CardSentence[];
  progress: Pick<
    WordProgress,
    | 'round1_completed'
    | 'round2_completed'
    | 'mode2_completed'
    | 'mode3_completed'
    | 'total_score'
    | 'last_practiced'
  > | null;
}

@Injectable()
export class CardsService {
  constructor(
    @InjectRepository(VocabCard)
    private readonly repo: Repository<VocabCard>,
    @InjectRepository(WordProgress)
    private readonly progressRepo: Repository<WordProgress>,
    private readonly cardSentencesService: CardSentencesService,
  ) {}

  async findAll(userId: string): Promise<CardWithProgress[]> {
    const [cards, progressRows, sentencesByCard] = await Promise.all([
      this.repo.find({ where: { userId }, order: { addedAt: 'DESC' } }),
      this.progressRepo.find({ where: { userId } }),
      this.cardSentencesService.findAllByUser(userId),
    ]);

    const progressByWordId = new Map(progressRows.map((p) => [p.wordId, p]));

    return cards.map((card) => {
      const p = progressByWordId.get(card.id) ?? null;
      return {
        ...card,
        example: sentencesByCard.get(card.id) ?? [],
        progress: p
          ? {
              round1_completed: p.round1_completed,
              round2_completed: p.round2_completed,
              mode2_completed: p.mode2_completed,
              mode3_completed: p.mode3_completed,
              total_score: p.total_score,
              last_practiced: p.last_practiced,
            }
          : null,
      };
    });
  }

  async findCard(id: string, userId: string): Promise<VocabCard> {
    return this.findEntity(id, userId);
  }

  private async findEntity(id: string, userId: string): Promise<VocabCard> {
    const card = await this.repo.findOne({ where: { id, userId } });
    if (!card) throw new NotFoundException({ message: 'Card not found' });
    return card;
  }

  async findOne(id: string, userId: string) {
    const card = await this.findEntity(id, userId);
    const sentences = await this.cardSentencesService.findByCard(id, userId);
    return { ...card, example: sentences };
  }

  async create(userId: string, dto: CreateCardDto): Promise<VocabCard> {
    const card = await this.repo.save(
      this.repo.create({
        userId,
        word: dto.word,
        pos: dto.pos ?? 'noun',
        pron: dto.pron ?? '',
        explanation: dto.explanation ?? '',
        example: [],
      }),
    );

    if (dto.example) {
      await this.cardSentencesService.saveOne(card.id, userId, dto.example);
    }

    return card;
  }

  async update(id: string, userId: string, dto: UpdateCardDto) {
    const fields = Object.keys(dto).filter(
      (k) => dto[k as keyof UpdateCardDto] !== undefined,
    );
    if (fields.length === 0) {
      throw new BadRequestException({ message: 'No valid fields to update' });
    }

    const card = await this.findEntity(id, userId);
    for (const key of fields) {
      (card as unknown as Record<string, unknown>)[key] =
        dto[key as keyof UpdateCardDto];
    }
    await this.repo.save(card);
    return this.findOne(id, userId);
  }

  async remove(id: string, userId: string): Promise<void> {
    const card = await this.findEntity(id, userId);
    await this.repo.remove(card);
  }
}
