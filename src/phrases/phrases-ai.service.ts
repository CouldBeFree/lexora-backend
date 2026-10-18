import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Anthropic from '@anthropic-ai/sdk';
import { PhraseCard } from './entities/phrase-card.entity';

export interface PhraseDetails {
  explanation: string;
  example: string;
}

interface AiExampleResult {
  sentence: string;
}

@Injectable()
export class PhrasesAiService {
  private client: Anthropic | null = null;

  constructor(private readonly config: ConfigService) {}

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

  // Explanation + 1 example in a single call
  async generateDetails(phrase: string): Promise<PhraseDetails> {
    const nonce = Math.random().toString(36).slice(2, 10);

    const prompt = `You are a vocabulary assistant helping a student learn English phrases. [Request ID: ${nonce}]

Explain the English phrase "${phrase}" and write one example sentence that uses it.

Rules:
- Write the explanation in English, in 1–2 short sentences
- Explain the meaning of the phrase as a whole, not word by word
- In the example, use the most natural grammatical form of the phrase
  (e.g. past tense, third person — whatever fits naturally)
- The meaning of the phrase must be clear from the example's context`;

    return this.callAi<PhraseDetails>(
      prompt,
      {
        type: 'object',
        properties: {
          explanation: { type: 'string' },
          example: { type: 'string' },
        },
        required: ['explanation', 'example'],
        additionalProperties: false,
      },
      1024,
    );
  }

  async generateExample(card: PhraseCard, existing: string[]): Promise<string> {
    const allContexts = [
      'professional',
      'academic',
      'everyday life',
      'historical',
      'scientific',
      'emotional',
      'narrative',
    ];
    const context = allContexts[Math.floor(Math.random() * allContexts.length)];
    const nonce = Math.random().toString(36).slice(2, 10);
    // newest first; cap so the prompt stays small for phrases with many examples
    const existingList = existing
      .slice(0, 20)
      .map((s) => `- ${s}`)
      .join('\n');

    const prompt = `You are a vocabulary assistant helping a student learn English phrases. [Request ID: ${nonce}]

Write exactly 1 new English example sentence that naturally uses the phrase below.

Rules:
- Use the most natural grammatical form of the phrase
  (e.g. past tense, third person — whatever fits naturally)
- The meaning of the phrase must be clear from context
- Context category: ${context}
- Do NOT reuse or paraphrase any of the existing examples

Phrase: ${card.phrase}
${card.explanation ? `Meaning: ${card.explanation}` : ''}
${existingList ? `Existing examples (do NOT reuse):\n${existingList}` : ''}`;

    const result = await this.callAi<AiExampleResult>(
      prompt,
      {
        type: 'object',
        properties: { sentence: { type: 'string' } },
        required: ['sentence'],
        additionalProperties: false,
      },
      512,
    );
    return result.sentence;
  }

  private async callAi<T>(
    prompt: string,
    schema: Record<string, unknown>,
    maxTokens: number,
  ): Promise<T> {
    const client = this.getClient();

    let response: Anthropic.Message;
    try {
      response = await client.messages.create({
        model: 'claude-sonnet-4-6',
        max_tokens: maxTokens,
        temperature: 1,
        output_config: { format: { type: 'json_schema', schema } },
        messages: [{ role: 'user', content: prompt }],
      });
    } catch {
      throw new ServiceUnavailableException({ message: 'AI service error' });
    }

    const text = response.content.find((b) => b.type === 'text');
    if (!text || text.type !== 'text') {
      throw new ServiceUnavailableException({
        message: 'Unexpected AI response',
      });
    }

    try {
      return JSON.parse(text.text) as T;
    } catch {
      throw new ServiceUnavailableException({
        message: 'Failed to parse AI response',
      });
    }
  }
}
