/**
 * Claude：用官方 SDK 和结构化输出，回答一定是合法的 JSON。
 */

import Anthropic from '@anthropic-ai/sdk';
import { betaZodOutputFormat } from '@anthropic-ai/sdk/helpers/beta/zod';

import { REFLECTION_SYSTEM, ReflectionSchema, reflectionPrompt, WEEKLY_SYSTEM, WeeklySchema, weeklyPrompt } from './prompts';
import type { ClaudeModel } from './providers';
import {
  type AiProvider,
  AiFormatError,
  AiRefusalError,
  type Reflection,
  type ReflectionInput,
  type WeeklyDraft,
  type WeeklyInput,
} from './types';

function readParsed<T>(response: { stop_reason: string | null; parsed_output: T | null }): T {
  if (response.stop_reason === 'refusal') throw new AiRefusalError();
  if (response.parsed_output === null) throw new AiFormatError();
  return response.parsed_output;
}

export class ClaudeProvider implements AiProvider {
  private readonly client: Anthropic;

  constructor(
    apiKey: string,
    private readonly model: ClaudeModel,
  ) {
    this.client = new Anthropic({
      apiKey,
      // 密钥是用户自己的，只存在这台设备上；网页预览时 SDK 需要这个开关才允许直接调用。
      dangerouslyAllowBrowser: true,
      timeout: 120_000,
    });
  }

  /** Opus 和 Sonnet 被安全分类器拒绝时，由服务端自动换一个模型重试；Haiku 没有这项功能。 */
  private fallback() {
    if (this.model === 'claude-haiku-5-5') return {};
    return { betas: ['server-side-fallback-2026-07-01'], fallbacks: 'default' as const };
  }

  async reflect(input: ReflectionInput): Promise<Reflection> {
    const response = await this.client.beta.messages.parse({
      model: this.model,
      max_tokens: 16000,
      ...this.fallback(),
      output_config: { effort: 'low', format: betaZodOutputFormat(ReflectionSchema) },
      system: REFLECTION_SYSTEM,
      messages: [{ role: 'user', content: reflectionPrompt(input) }],
    });
    const parsed = readParsed(response);
    return { category: parsed.category, reply: parsed.reply.trim() };
  }

  async writeWeekly(input: WeeklyInput): Promise<WeeklyDraft> {
    const response = await this.client.beta.messages.parse({
      model: this.model,
      max_tokens: 16000,
      ...this.fallback(),
      output_config: { effort: 'medium', format: betaZodOutputFormat(WeeklySchema) },
      system: WEEKLY_SYSTEM,
      messages: [{ role: 'user', content: weeklyPrompt(input) }],
    });
    const parsed = readParsed(response);
    return {
      summary: parsed.summary.trim(),
      highlights: parsed.highlights.map((h) => h.trim()).filter(Boolean).slice(0, 3),
      comparison: parsed.comparison.trim(),
    };
  }

  async check(): Promise<void> {
    await this.client.models.retrieve(this.model);
  }
}
