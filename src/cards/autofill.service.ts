import {
  Injectable,
  BadRequestException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Anthropic from '@anthropic-ai/sdk';

export interface AutofillResult {
  explanation: string;
  exampleSentence: string;
  partOfSpeech: string;
}

@Injectable()
export class AutofillService {
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

  async autofill(word: string): Promise<AutofillResult> {
    const trimmed = word.trim();
    if (!trimmed)
      throw new BadRequestException({ message: 'word is required' });
    const client = this.getClient();
    const nonce = Math.random().toString(36).slice(2, 10);

    let response: Anthropic.Message;
    try {
      response = await client.messages.create({
        model: 'claude-sonnet-4-6',
        max_tokens: 1024,
        temperature: 1,
        output_config: {
          format: {
            type: 'json_schema',
            schema: {
              type: 'object',
              properties: {
                explanation: { type: 'string' },
                exampleSentence: { type: 'string' },
                partOfSpeech: {
                  type: 'string',
                  enum: [
                    'noun',
                    'verb',
                    'adjective',
                    'adverb',
                    'pronoun',
                    'preposition',
                    'conjunction',
                    'interjection',
                  ],
                },
              },
              required: ['explanation', 'exampleSentence', 'partOfSpeech'],
              additionalProperties: false,
            },
          },
        },
        messages: [
          {
            role: 'user',
            content: `[Request ID: ${nonce}] Provide the definition, a natural example sentence, and the part of speech for the English word: "${trimmed}"`,
          },
        ],
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
      return JSON.parse(text.text) as AutofillResult;
    } catch {
      throw new ServiceUnavailableException({
        message: 'Failed to parse AI response',
      });
    }
  }
}
