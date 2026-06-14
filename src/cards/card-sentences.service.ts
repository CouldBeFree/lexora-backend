import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import Anthropic from '@anthropic-ai/sdk';
import { VocabCard } from './entities/vocab-card.entity';
import { CardSentenceEntity } from './entities/card-sentence.entity';

export interface CardSentence {
  id: string;
  sentence: string;
  createdAt: Date;
}

interface AiSentenceResult {
  sentence: string;
}

@Injectable()
export class CardSentencesService {
  private client: Anthropic | null = null;

  constructor(
    private readonly config: ConfigService,
    @InjectRepository(CardSentenceEntity)
    private readonly repo: Repository<CardSentenceEntity>,
  ) {}

  private getClient(): Anthropic {
    if (!this.client) {
      const apiKey = this.config.get<string>('ANTHROPIC_API_KEY');
      if (!apiKey) {
        throw new ServiceUnavailableException({
          message: 'ANTHROPIC_API_KEY is not configured',
        });
      }
      this.client = new Anthropic({ apiKey });
    }
    return this.client;
  }

  private buildPrompt(card: VocabCard): string {
    const allContexts = [
      'professional',
      'academic',
      'everyday life',
      'historical',
      'scientific',
      'emotional',
      'narrative',
    ];
    const shuffledContexts = allContexts
      .sort(() => Math.random() - 0.5)
      .slice(0, 3);
    const contextList = shuffledContexts
      .map((ctx, i) => `  Sentence ${i + 1}: ${ctx}`)
      .join('\n');
    const nonce = Math.random().toString(36).slice(2, 10);
    const existingExample = card.example?.[0] ?? '';

    return `You are a vocabulary practice assistant. [Request ID: ${nonce}]

I will give you a single English word with its definition and an example sentence.
Generate exactly 2 unique English example sentences that naturally use the word.

Rules:
- Use the word directly in the sentence (do NOT replace it with _____)
- Use the most natural grammatical form of the word
  (e.g. past tense, gerund, plural, third person — whatever fits naturally)
- Each sentence must be completely unique — different context, setting, subject, tense, and tone
- Do NOT reuse or paraphrase the existing example sentence
- The meaning of the word must be clear from context
- Use exactly these context categories in this exact order:
${contextList}

Word: ${card.word}
Part of speech: ${card.pos}
Definition: ${card.explanation}
${existingExample ? `Example (do NOT reuse): ${existingExample}` : ''}

Respond ONLY with a valid JSON array, no markdown, no extra text:
[
  {
    "sentence": "The manager's silence had a clear implication that the project had not gone as planned."
  },
  {
    "sentence": "Her hesitation carried the implication that she was not fully convinced by the argument."
  }
]`;
  }

  private async callAi(card: VocabCard): Promise<string[]> {
    const client = this.getClient();
    let raw: string;
    try {
      const response = await client.messages.create({
        model: 'claude-sonnet-4-6',
        max_tokens: 512,
        temperature: 1,
        messages: [{ role: 'user', content: this.buildPrompt(card) }],
      });
      const block = response.content.find((b) => b.type === 'text');
      raw = block?.type === 'text' ? block.text : '';
    } catch {
      throw new ServiceUnavailableException({ message: 'AI service error' });
    }

    let parsed: AiSentenceResult[];
    try {
      parsed = JSON.parse(raw) as AiSentenceResult[];
    } catch {
      throw new ServiceUnavailableException({
        message: 'Failed to parse AI response',
      });
    }

    return parsed.map((item) => item.sentence);
  }

  async saveOne(
    cardId: string,
    userId: string,
    sentence: string,
  ): Promise<void> {
    await this.repo.save(this.repo.create({ cardId, userId, sentence }));
  }

  async generateStrings(card: VocabCard): Promise<string[]> {
    return this.callAi(card);
  }

  async generateSentences(
    card: VocabCard,
    userId: string,
  ): Promise<CardSentence[]> {
    const sentences = await this.callAi(card);

    const entities = this.repo.create(
      sentences.map((sentence) => ({ cardId: card.id, userId, sentence })),
    );
    const saved = await this.repo.save(entities);

    return saved.map((e) => ({
      id: e.id,
      sentence: e.sentence,
      createdAt: e.createdAt,
    }));
  }

  async findByCard(cardId: string, userId: string): Promise<CardSentence[]> {
    const rows = await this.repo.find({
      where: { cardId, userId },
      order: { createdAt: 'DESC' },
    });
    return rows.map((e) => ({
      id: e.id,
      sentence: e.sentence,
      createdAt: e.createdAt,
    }));
  }

  async findAllByUser(userId: string): Promise<Map<string, CardSentence[]>> {
    const rows = await this.repo.find({
      where: { userId },
      order: { createdAt: 'DESC' },
    });
    const map = new Map<string, CardSentence[]>();
    for (const e of rows) {
      const list = map.get(e.cardId) ?? [];
      list.push({ id: e.id, sentence: e.sentence, createdAt: e.createdAt });
      map.set(e.cardId, list);
    }
    return map;
  }
}
