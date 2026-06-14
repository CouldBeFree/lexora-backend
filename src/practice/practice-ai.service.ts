import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Anthropic from '@anthropic-ai/sdk';
import { VocabCard } from '../cards/entities/vocab-card.entity';

export interface Round1Item {
  wordId: string;
  sentence: string;
  options: string[];
  correctWord: string;
}

export interface Round2Item {
  wordId: string;
  sentence: string;
  expectedWord: string;
}

export interface Mode2Sentence {
  index: number;
  sentence: string;
  expectedWord: string;
}

export interface Mode2Item {
  wordId: string;
  sentences: Mode2Sentence[];
}

export interface Mode3CheckResult {
  wordUsedCorrectly: boolean;
  explanation: string;
  grammarFeedback: string;
}

interface AiRound1Result {
  wordId: string;
  sentence: string;
  correctWord: string;
  distractors: string[];
}

interface AiRound2Result {
  wordId: string;
  sentence: string;
  expectedWord: string;
}

interface AiMode2Sentence {
  index: number;
  sentence: string;
  expectedWord: string;
}

interface AiMode3CheckResult {
  wordUsedCorrectly: boolean;
  explanation: string;
  grammarFeedback: string;
}

@Injectable()
export class PracticeAiService {
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

  async generateRound1(cards: VocabCard[]): Promise<Round1Item[]> {
    const client = this.getClient();

    const wordList = cards
      .map(
        (c) =>
          `{"wordId":"${c.id}","word":"${c.word}","pos":"${c.pos}","explanation":"${c.explanation}","example":"${c.example?.[0] ?? ''}"}`,
      )
      .join(',\n');

    const nonce = Math.random().toString(36).slice(2, 10);

    const prompt = `You are a vocabulary practice assistant. [Request ID: ${nonce}]

I will give you a list of English words with their definitions and example sentences.
For each word, generate:
1. A unique English sentence where the word is replaced with _____.
   The sentence must make the correct word obvious from context.
   Do NOT reuse or paraphrase the existing example sentence.
   Each sentence must be completely unique.
2. Three distractor words (incorrect options) that are:
   - The same part of speech as the target word
   - Plausible in the sentence but clearly wrong in meaning
   - From a similar vocabulary level

Words:
[${wordList}]

Respond ONLY with a valid JSON array, no markdown, no extra text:
[
  {
    "wordId": "{{wordId}}",
    "sentence": "The manager tried to _____ strict rules on the team.",
    "correctWord": "impose",
    "distractors": ["deduce", "propel", "obliterate"]
  }
]`;

    let raw: string;
    try {
      const response = await client.messages.create({
        model: 'claude-sonnet-4-6',
        max_tokens: 4096,
        temperature: 1,
        messages: [{ role: 'user', content: prompt }],
      });
      const block = response.content.find((b) => b.type === 'text');
      raw = block?.type === 'text' ? block.text : '';
    } catch {
      throw new ServiceUnavailableException({ message: 'AI service error' });
    }

    let parsed: AiRound1Result[];
    try {
      parsed = JSON.parse(raw) as AiRound1Result[];
    } catch {
      throw new ServiceUnavailableException({
        message: 'Failed to parse AI response',
      });
    }

    return parsed.map((item) => {
      const options = [item.correctWord, ...item.distractors].sort(
        () => Math.random() - 0.5,
      );
      return {
        wordId: item.wordId,
        sentence: item.sentence,
        options,
        correctWord: item.correctWord,
      };
    });
  }

  async generateRound2(cards: VocabCard[]): Promise<Round2Item[]> {
    const client = this.getClient();

    const wordList = cards
      .map(
        (c) =>
          `{"wordId":"${c.id}","word":"${c.word}","pos":"${c.pos}","explanation":"${c.explanation}","example":"${c.example?.[0] ?? ''}"}`,
      )
      .join(',\n');

    const nonce = Math.random().toString(36).slice(2, 10);

    const prompt = `You are a vocabulary practice assistant. [Request ID: ${nonce}]

I will give you a list of English words with their definitions and example sentences.
For each word, generate a unique English sentence where the word is replaced with _____.

Rules:
- Use the most natural grammatical form of the word in the sentence
  (e.g. past tense, gerund, plural, third person — whatever fits naturally)
- NEVER use the dictionary base form or "To + verb" form as the answer
- The "expectedWord" field must contain the exact word form used in _____
- The sentence must make the correct word obvious from context
- Do NOT reuse or paraphrase the existing example sentence
- Each sentence must be completely unique
- The sentence should be more complex and nuanced than a Round 1 sentence,
  since the student has already seen this word once
- Vary the setting, subject, tense, and tone
- Use different context categories: professional, academic, everyday life,
  historical, scientific, emotional, narrative

Words:
[${wordList}]

Respond ONLY with a valid JSON array, no markdown, no extra text:
[
  {
    "wordId": "{{wordId}}",
    "sentence": "Her ambition ultimately _____ her to the top of the industry.",
    "expectedWord": "propelled"
  }
]`;

    let raw: string;
    try {
      const response = await client.messages.create({
        model: 'claude-sonnet-4-6',
        max_tokens: 2048,
        temperature: 1,
        messages: [{ role: 'user', content: prompt }],
      });
      const block = response.content.find((b) => b.type === 'text');
      raw = block?.type === 'text' ? block.text : '';
    } catch {
      throw new ServiceUnavailableException({ message: 'AI service error' });
    }

    let parsed: AiRound2Result[];
    try {
      parsed = JSON.parse(raw) as AiRound2Result[];
    } catch {
      throw new ServiceUnavailableException({
        message: 'Failed to parse AI response',
      });
    }

    return parsed.map((item) => ({
      wordId: item.wordId,
      sentence: item.sentence,
      expectedWord: item.expectedWord,
    }));
  }

  async generateMode2(card: VocabCard): Promise<Mode2Item> {
    const client = this.getClient();

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
      .slice(0, 5);
    const contextList = shuffledContexts
      .map((ctx, i) => `  Sentence ${i + 1}: ${ctx}`)
      .join('\n');
    const nonce = Math.random().toString(36).slice(2, 10);

    const prompt = `You are a vocabulary practice assistant. [Request ID: ${nonce}]

I will give you a single English word with its definition and an example sentence.
Generate exactly 5 unique English sentences where the word is replaced with _____.

Rules:
- Use the most natural grammatical form of the word in each sentence
  (e.g. past tense, gerund, plural, third person — whatever fits naturally)
- NEVER use the dictionary base form or "To + verb" form as the answer
- The "expectedWord" field must contain the exact word form used in _____
- Each sentence must be completely unique — different context, setting,
  subject, tense, and tone
- Do NOT reuse or paraphrase the existing example sentence
- Each sentence should make the correct word obvious from context
- Use exactly these context categories in this exact order:
${contextList}

Word: ${card.word}
Part of speech: ${card.pos}
Definition: ${card.explanation}
Example (do NOT reuse): ${card.example?.[0] ?? ''}

Respond ONLY with a valid JSON array, no markdown, no extra text:
[
  {
    "index": 1,
    "sentence": "Her ambition ultimately _____ her to the top of the industry.",
    "expectedWord": "propelled"
  },
  {
    "index": 2,
    "sentence": "The strong winds _____ the sailboat across the open ocean.",
    "expectedWord": "propelled"
  },
  {
    "index": 3,
    "sentence": "His curiosity _____ him to explore every corner of the ancient city.",
    "expectedWord": "propelled"
  },
  {
    "index": 4,
    "sentence": "The explosion _____ debris across a wide area.",
    "expectedWord": "propelled"
  },
  {
    "index": 5,
    "sentence": "Fear of failure _____ her to work harder than anyone else.",
    "expectedWord": "propelled"
  }
]`;

    let raw: string;
    try {
      const response = await client.messages.create({
        model: 'claude-sonnet-4-6',
        max_tokens: 2048,
        temperature: 1,
        messages: [{ role: 'user', content: prompt }],
      });
      const block = response.content.find((b) => b.type === 'text');
      raw = block?.type === 'text' ? block.text : '';
    } catch {
      throw new ServiceUnavailableException({ message: 'AI service error' });
    }

    let parsed: AiMode2Sentence[];
    try {
      parsed = JSON.parse(raw) as AiMode2Sentence[];
    } catch {
      throw new ServiceUnavailableException({
        message: 'Failed to parse AI response',
      });
    }

    return {
      wordId: card.id,
      sentences: parsed.map((item) => ({
        index: item.index,
        sentence: item.sentence,
        expectedWord: item.expectedWord,
      })),
    };
  }

  async generateMode3Hint(card: VocabCard): Promise<string> {
    const client = this.getClient();
    const nonce = Math.random().toString(36).slice(2, 10);

    const prompt = `You are a vocabulary practice assistant helping a Ukrainian student learn English. [Request ID: ${nonce}]

The student is practicing the English word: "${card.word}"
Part of speech: ${card.pos}
Definition: ${card.explanation}
Example sentence (do NOT reuse): ${card.example?.[0] ?? ''}

Generate ONE Ukrainian sentence that:
- Clearly expresses a situation where the English word "${card.word}" would be
  used naturally in the translation
- Uses a different context, setting, and tone every time this is called —
  treat each call as completely fresh
- Is natural, conversational Ukrainian
- Is not a direct translation of the example sentence
- Varies across these context categories:
  professional, academic, everyday life, historical, scientific, emotional, narrative

Respond ONLY with a valid JSON object, no markdown, no extra text:
{
  "hint": "Ukrainian sentence here"
}`;

    let raw: string;
    try {
      const response = await client.messages.create({
        model: 'claude-sonnet-4-6',
        max_tokens: 512,
        temperature: 1,
        messages: [{ role: 'user', content: prompt }],
      });
      const block = response.content.find((b) => b.type === 'text');
      raw = block?.type === 'text' ? block.text : '';
    } catch {
      throw new ServiceUnavailableException({ message: 'AI service error' });
    }

    let parsed: { hint: string };
    try {
      parsed = JSON.parse(raw) as { hint: string };
    } catch {
      throw new ServiceUnavailableException({
        message: 'Failed to parse AI response',
      });
    }

    return parsed.hint;
  }

  async checkMode3(
    card: VocabCard,
    userSentence: string,
    hintSentence?: string,
  ): Promise<Mode3CheckResult> {
    const client = this.getClient();
    const nonce = Math.random().toString(36).slice(2, 10);

    const hintBlock = hintSentence
      ? `\nThe student was given this Ukrainian sentence as a hint to translate:\n"${hintSentence}"\n`
      : '';
    const hintEvalLine = hintSentence
      ? '\n   - Also consider whether the student\'s sentence reflects the meaning\n     of the Ukrainian hint sentence'
      : '';

    const prompt = `You are an English language teacher helping a Ukrainian student learn vocabulary. [Request ID: ${nonce}]

The student is practicing the word: "${card.word}"
Part of speech: ${card.pos}
Definition: ${card.explanation}
${hintBlock}
The student wrote this English sentence:
"${userSentence}"

Your task:
1. Check if the word "${card.word}" (or any of its grammatical forms) is used
   correctly and naturally in the sentence.
   - Consider the word used correctly if its meaning matches the definition
     and it fits naturally in the context
   - Accept all valid grammatical forms (past tense, gerund, plural, etc.)
   - Do NOT penalize grammar mistakes when judging word usage —
     evaluate word usage independently from grammar${hintEvalLine}

2. Check the sentence for grammar mistakes.
   - List all grammar mistakes clearly in Ukrainian
   - If the sentence is grammatically correct, say so in Ukrainian

3. Respond in Ukrainian language only.

Respond ONLY with a valid JSON object, no markdown, no extra text:
{
  "wordUsedCorrectly": true or false,
  "explanation": "Explain in Ukrainian why the word is used correctly or incorrectly.",
  "grammarFeedback": "List grammar mistakes in Ukrainian, or confirm the sentence is correct."
}`;

    let raw: string;
    try {
      const response = await client.messages.create({
        model: 'claude-sonnet-4-6',
        max_tokens: 1024,
        temperature: 1,
        messages: [{ role: 'user', content: prompt }],
      });
      const block = response.content.find((b) => b.type === 'text');
      raw = block?.type === 'text' ? block.text : '';
    } catch {
      throw new ServiceUnavailableException({ message: 'AI service error' });
    }

    let parsed: AiMode3CheckResult;
    try {
      parsed = JSON.parse(raw) as AiMode3CheckResult;
    } catch {
      throw new ServiceUnavailableException({
        message: 'Failed to parse AI response',
      });
    }

    return {
      wordUsedCorrectly: parsed.wordUsedCorrectly,
      explanation: parsed.explanation,
      grammarFeedback: parsed.grammarFeedback,
    };
  }
}
