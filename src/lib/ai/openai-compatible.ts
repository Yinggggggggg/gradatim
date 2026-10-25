/**
 * 兼容 OpenAI 接口的服务：DeepSeek、通义千问、智谱、Kimi、电脑上的 Ollama，以及任何自定义地址。
 * 各家对 JSON 模式的支持不一，所以先请求 JSON 模式，不支持就退回到靠提示词约束，最后宽松地解析。
 */

import { z } from 'zod';

import { normalizeCategory } from '../categories';
import { REFLECTION_JSON_SHAPE, REFLECTION_SYSTEM, reflectionPrompt, WEEKLY_JSON_SHAPE, WEEKLY_SYSTEM, weeklyPrompt } from './prompts';
import {
  type AiProvider,
  AiFormatError,
  ModelNotFoundError,
  ProviderHttpError,
  ProviderNetworkError,
  ProviderTimeoutError,
  type Reflection,
  type ReflectionInput,
  type WeeklyDraft,
  type WeeklyInput,
} from './types';

/** 电脑上的模型可能比较慢，多等一会儿。 */
const REQUEST_TIMEOUT_MS = 180_000;

const LooseReflection = z.object({
  category: z.string().optional(),
  reply: z.string(),
});

const LooseWeekly = z.object({
  summary: z.string(),
  highlights: z.array(z.string()).optional(),
  comparison: z.string(),
});

const ChatResponse = z.object({
  choices: z.array(z.object({ message: z.object({ content: z.string().nullable().optional() }) })).min(1),
});

const ModelList = z.object({
  data: z.array(z.object({ id: z.string() })),
});

/** 去掉推理模型的思考过程和代码块包装，取出第一个 JSON 对象。 */
export function parseJsonObject(text: string): unknown {
  const answer = text.replace(/<think>[\s\S]*?<\/think>/g, '');
  const start = answer.indexOf('{');
  const end = answer.lastIndexOf('}');
  if (start === -1 || end <= start) return null;
  try {
    return JSON.parse(answer.slice(start, end + 1));
  } catch {
    return null;
  }
}

export class OpenAICompatibleProvider implements AiProvider {
  constructor(
    private readonly baseUrl: string,
    private readonly model: string,
    private readonly apiKey: string | null,
  ) {}

  private async send(method: 'GET' | 'POST', path: string, body?: object): Promise<Response> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    try {
      return await fetch(`${this.baseUrl.replace(/\/+$/, '')}${path}`, {
        method,
        headers: {
          'Content-Type': 'application/json',
          ...(this.apiKey ? { Authorization: `Bearer ${this.apiKey}` } : {}),
        },
        body: body ? JSON.stringify(body) : undefined,
        signal: controller.signal,
      });
    } catch {
      throw controller.signal.aborted ? new ProviderTimeoutError() : new ProviderNetworkError();
    } finally {
      clearTimeout(timer);
    }
  }

  private async chat(system: string, user: string): Promise<string> {
    const request = {
      model: this.model,
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: user },
      ],
    };
    let response = await this.send('POST', '/chat/completions', { ...request, response_format: { type: 'json_object' } });
    // 有的模型不支持 JSON 模式，会回 400，去掉再试一次
    if (response.status === 400) response = await this.send('POST', '/chat/completions', request);
    if (!response.ok) throw new ProviderHttpError(response.status);

    const parsed = ChatResponse.safeParse(await response.json().catch(() => null));
    const content = parsed.success ? parsed.data.choices[0].message.content : null;
    if (!content) throw new AiFormatError();
    return content;
  }

  async reflect(input: ReflectionInput): Promise<Reflection> {
    const text = await this.chat(`${REFLECTION_SYSTEM}\n\n${REFLECTION_JSON_SHAPE}`, reflectionPrompt(input));
    const parsed = LooseReflection.safeParse(parseJsonObject(text));
    if (!parsed.success || !parsed.data.reply.trim()) throw new AiFormatError();
    return { category: normalizeCategory(parsed.data.category), reply: parsed.data.reply.trim() };
  }

  async writeWeekly(input: WeeklyInput): Promise<WeeklyDraft> {
    const text = await this.chat(`${WEEKLY_SYSTEM}\n\n${WEEKLY_JSON_SHAPE}`, weeklyPrompt(input));
    const parsed = LooseWeekly.safeParse(parseJsonObject(text));
    if (!parsed.success) throw new AiFormatError();
    return {
      summary: parsed.data.summary.trim(),
      highlights: (parsed.data.highlights ?? []).map((h) => h.trim()).filter(Boolean).slice(0, 3),
      comparison: parsed.data.comparison.trim(),
    };
  }

  /** 服务商提供的模型名列表，按字母排序。 */
  async listModels(): Promise<string[]> {
    const response = await this.send('GET', '/models');
    if (!response.ok) throw new ProviderHttpError(response.status);
    const parsed = ModelList.safeParse(await response.json().catch(() => null));
    return parsed.success ? parsed.data.data.map((model) => model.id).sort() : [];
  }

  async check(): Promise<void> {
    const response = await this.send('GET', '/models');
    if (response.ok) {
      const parsed = ModelList.safeParse(await response.json().catch(() => null));
      const ids = parsed.success ? parsed.data.data.map((model) => model.id) : [];
      if (ids.length > 0 && !ids.includes(this.model)) throw new ModelNotFoundError(this.model, ids.sort());
      return;
    }
    if (response.status !== 404 && response.status !== 405) throw new ProviderHttpError(response.status);
    // 不提供模型列表的服务，直接发一句最短的话试试
    await this.chat('只输出 JSON：{"ok": true}', 'ping');
  }
}
