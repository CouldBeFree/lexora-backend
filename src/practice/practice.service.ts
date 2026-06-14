import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Cron, CronExpression } from '@nestjs/schedule';
import { WordProgress } from './entities/word-progress.entity';
import { VocabCard, Mastery } from '../cards/entities/vocab-card.entity';
import {
  PracticeAiService,
  Round1Item,
  Round2Item,
  Mode2Item,
  Mode3CheckResult,
} from './practice-ai.service';

@Injectable()
export class PracticeService {
  constructor(
    @InjectRepository(WordProgress)
    private readonly progressRepo: Repository<WordProgress>,
    @InjectRepository(VocabCard)
    private readonly cardRepo: Repository<VocabCard>,
    private readonly aiService: PracticeAiService,
  ) {}

  async generateRound1(
    userId: string,
    wordIds: string[],
  ): Promise<Round1Item[]> {
    const cards = await this.getCardsForUser(userId, wordIds);
    return this.aiService.generateRound1(cards);
  }

  async generateRound2(
    userId: string,
    wordIds: string[],
  ): Promise<Round2Item[]> {
    const cards = await this.getCardsForUser(userId, wordIds);
    return this.aiService.generateRound2(cards);
  }

  async scoreRound1(
    userId: string,
    wordId: string,
    correct: boolean,
  ): Promise<WordProgress> {
    const progress = await this.findOrCreateProgress(userId, wordId);

    if (correct && !progress.round1_completed) {
      progress.round1_completed = true;
      progress.total_score = Math.min(progress.total_score + 1, 4);
    }

    progress.last_practiced = new Date();
    progress.last_decay_at = null;

    await this.progressRepo.save(progress);
    await this.syncMastery(wordId, progress.total_score);

    return progress;
  }

  async scoreRound2(
    userId: string,
    wordId: string,
    correct: boolean,
  ): Promise<WordProgress> {
    const progress = await this.findOrCreateProgress(userId, wordId);

    if (correct && !progress.round2_completed) {
      progress.round2_completed = true;
      progress.total_score = Math.min(progress.total_score + 1, 4);
    }

    progress.last_practiced = new Date();
    progress.last_decay_at = null;

    await this.progressRepo.save(progress);
    await this.syncMastery(wordId, progress.total_score);

    return progress;
  }

  async generateMode2(userId: string, wordId: string): Promise<Mode2Item> {
    const card = await this.cardRepo.findOne({ where: { id: wordId, userId } });
    if (!card) throw new NotFoundException({ message: 'Card not found' });
    return this.aiService.generateMode2(card);
  }

  async scoreMode2(
    userId: string,
    wordId: string,
    correct: boolean,
  ): Promise<WordProgress> {
    const progress = await this.findOrCreateProgress(userId, wordId);

    if (correct && !progress.mode2_completed) {
      progress.mode2_completed = true;
      progress.total_score = Math.min(progress.total_score + 1, 4);
    }

    progress.last_practiced = new Date();
    progress.last_decay_at = null;

    await this.progressRepo.save(progress);
    await this.syncMastery(wordId, progress.total_score);

    return progress;
  }

  async getMode3Hint(
    userId: string,
    wordId: string,
  ): Promise<{ hint: string }> {
    const card = await this.cardRepo.findOne({ where: { id: wordId, userId } });
    if (!card) throw new NotFoundException({ message: 'Card not found' });
    const hint = await this.aiService.generateMode3Hint(card);
    return { hint };
  }

  async checkMode3(
    userId: string,
    wordId: string,
    sentence: string,
    hintSentence?: string,
  ): Promise<Mode3CheckResult> {
    const card = await this.cardRepo.findOne({ where: { id: wordId, userId } });
    if (!card) throw new NotFoundException({ message: 'Card not found' });
    return this.aiService.checkMode3(card, sentence, hintSentence);
  }

  async scoreMode3(
    userId: string,
    wordId: string,
    correct: boolean,
  ): Promise<WordProgress> {
    const progress = await this.findOrCreateProgress(userId, wordId);

    if (correct && !progress.mode3_completed) {
      progress.mode3_completed = true;
      progress.total_score = Math.min(progress.total_score + 1, 4);
    }

    progress.last_practiced = new Date();
    progress.last_decay_at = null;

    await this.progressRepo.save(progress);
    await this.syncMastery(wordId, progress.total_score);

    return progress;
  }

  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  async decayCron(): Promise<void> {
    const now = new Date();
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const twentyThreeDaysAgo = new Date(
      now.getTime() - 23 * 24 * 60 * 60 * 1000,
    );

    // Condition A: practiced > 7 days ago, no prior decay, score > 0
    const conditionA = await this.progressRepo
      .createQueryBuilder('wp')
      .where('wp.last_practiced < :sevenDaysAgo', { sevenDaysAgo })
      .andWhere('wp.last_decay_at IS NULL')
      .andWhere('wp.total_score > 0')
      .getMany();

    // Condition B: practiced > 30 days ago, last decay > 23 days ago, score > 0
    const conditionB = await this.progressRepo
      .createQueryBuilder('wp')
      .where('wp.last_practiced < :thirtyDaysAgo', { thirtyDaysAgo })
      .andWhere('wp.last_decay_at IS NOT NULL')
      .andWhere('wp.last_decay_at < :twentyThreeDaysAgo', {
        twentyThreeDaysAgo,
      })
      .andWhere('wp.total_score > 0')
      .getMany();

    const toUpdate = [...conditionA, ...conditionB];

    for (const progress of toUpdate) {
      progress.total_score = Math.max(progress.total_score - 1, 0);
      progress.last_decay_at = now;
      await this.progressRepo.save(progress);
      await this.syncMastery(progress.wordId, progress.total_score);
    }
  }

  private async getCardsForUser(
    userId: string,
    wordIds: string[],
  ): Promise<VocabCard[]> {
    const cards: VocabCard[] = [];
    for (const id of wordIds) {
      const card = await this.cardRepo.findOne({ where: { id, userId } });
      if (!card)
        throw new NotFoundException({ message: `Card ${id} not found` });
      cards.push(card);
    }
    return cards;
  }

  private async findOrCreateProgress(
    userId: string,
    wordId: string,
  ): Promise<WordProgress> {
    let progress = await this.progressRepo.findOne({
      where: { userId, wordId },
    });
    if (!progress) {
      progress = this.progressRepo.create({
        userId,
        wordId,
        round1_completed: false,
        round2_completed: false,
        mode2_completed: false,
        mode3_completed: false,
        total_score: 0,
        last_practiced: null,
        last_decay_at: null,
      });
    }
    return progress;
  }

  private async syncMastery(wordId: string, totalScore: number): Promise<void> {
    const mastery = totalScore >= 4 ? Mastery.MASTERED : Mastery.LEARNING;
    await this.cardRepo.update(wordId, { mastery });
  }
}
