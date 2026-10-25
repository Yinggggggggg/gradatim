/**
 * 手机本地模型：用 llama.rn 在手机上直接运行 Qwen3，不联网，记录不离开手机。
 * llama.rn 是原生模块，只在打包好的 App 里有；Expo Go 里没有，先检查再用。
 */

import { initLlama, type LlamaContext } from 'llama.rn';
import { TurboModuleRegistry } from 'react-native';
import { z } from 'zod';

import { isModelDownloaded, type LocalModel, modelFile } from '../local-model';
import {
  LOCAL_REFLECTION_SCHEMA,
  LOCAL_REFLECTION_SYSTEM,
  LOCAL_WEEKLY_SCHEMA,
  LOCAL_WEEKLY_SYSTEM,
  localReflectionPrompt,
  localWeeklyPrompt,
} from './local-prompts';
import { ReflectionSchema, WeeklySchema } from './prompts';
import {
  type AiProvider,
  AiFormatError,
  LocalModelMissingError,
  OnDeviceUnavailableError,
  type Reflection,
  type ReflectionInput,
  type WeeklyDraft,
  type WeeklyInput,
} from './types';

const CONTEXT_SIZE = 2048;
/** 闲置这么久就把模型从内存里卸掉，下次用时再加载。 */
const IDLE_RELEASE_MS = 2 * 60_000;

export function isOnDeviceSupported(): boolean {
  return TurboModuleRegistry.get('RNLlama') != null;
}

let loaded: { modelId: string; context: LlamaContext } | null = null;
let idleTimer: ReturnType<typeof setTimeout> | null = null;
// 所有加载、生成、卸载都排成一队，同一时间只做一件事
let queue: Promise<unknown> = Promise.resolve();

function enqueue<T>(job: () => Promise<T>): Promise<T> {
  const run = queue.then(job);
  queue = run.catch(() => undefined);
  return run;
}

async function unload(): Promise<void> {
  const previous = loaded;
  loaded = null;
  if (previous) await previous.context.release();
}

/** 删除或切换模型前调用，立刻释放内存。 */
export function releaseLocalModel(): Promise<void> {
  if (idleTimer) clearTimeout(idleTimer);
  idleTimer = null;
  return enqueue(unload);
}

function withModel<T>(model: LocalModel, task: (context: LlamaContext) => Promise<T>): Promise<T> {
  if (!isOnDeviceSupported()) return Promise.reject(new OnDeviceUnavailableError());
  if (!isModelDownloaded(model)) return Promise.reject(new LocalModelMissingError());
  return enqueue(async () => {
    if (idleTimer) clearTimeout(idleTimer);
    try {
      let context = loaded?.modelId === model.id ? loaded.context : null;
      if (!context) {
        await unload();
        context = await initLlama({ model: modelFile(model).uri, n_ctx: CONTEXT_SIZE, n_gpu_layers: 0 });
        loaded = { modelId: model.id, context };
      }
      return await task(context);
    } finally {
      idleTimer = setTimeout(() => void enqueue(unload), IDLE_RELEASE_MS);
    }
  });
}

/** 从模型输出里取出 JSON：去掉可能残留的思考过程和代码块标记，只取最外层的大括号。 */
function extractJson(output: string): unknown {
  const text = output.replace(/<think>[\s\S]*?<\/think>/g, '');
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start < 0 || end <= start) throw new SyntaxError('no JSON object in output');
  return JSON.parse(text.slice(start, end + 1));
}

async function generate<T>(
  context: LlamaContext,
  system: string,
  user: string,
  schema: object,
  validator: z.ZodType<T>,
  maxTokens: number,
): Promise<T> {
  // 先用模型自带的模板把对话排成提示词，这一步不加格式约束；再用 llama.cpp 最基础的 json_schema
  // 约束来生成。直接把 response_format 和 messages 一起交给 llama.rn 时，它会按模板自动生成约束和
  // 解析器，遇到 Qwen3 这种会“思考”的模型，在手机上约束会失效，写出来的就不是 JSON。
  const { prompt } = await context.getFormattedChat(
    [
      { role: 'system', content: system },
      { role: 'user', content: user },
    ],
    null,
    { jinja: true, enable_thinking: false },
  );
  let output = '';
  // 格式偶尔出问题就再生成一次，第二次不加随机，更稳
  for (const temperature of [0.3, 0]) {
    const result = await context.completion({
      prompt,
      response_format: { type: 'json_schema', json_schema: { strict: true, schema } },
      n_predict: maxTokens,
      temperature,
    });
    output = result.text || result.content;
    try {
      return validator.parse(extractJson(output));
    } catch {
      // 下一轮再试
    }
  }
  throw new AiFormatError(output.slice(0, 200));
}

export class OnDeviceProvider implements AiProvider {
  constructor(private readonly model: LocalModel) {}

  reflect(input: ReflectionInput): Promise<Reflection> {
    return withModel(this.model, async (context) => {
      const parsed = await generate(
        context,
        LOCAL_REFLECTION_SYSTEM,
        localReflectionPrompt(input),
        LOCAL_REFLECTION_SCHEMA,
        ReflectionSchema,
        200,
      );
      return { category: parsed.category, reply: parsed.reply.trim() };
    });
  }

  writeWeekly(input: WeeklyInput): Promise<WeeklyDraft> {
    return withModel(this.model, async (context) => {
      const parsed = await generate(context, LOCAL_WEEKLY_SYSTEM, localWeeklyPrompt(input), LOCAL_WEEKLY_SCHEMA, WeeklySchema, 600);
      return {
        summary: parsed.summary.trim(),
        highlights: parsed.highlights.map((h) => h.trim()).filter(Boolean).slice(0, 3),
        comparison: parsed.comparison.trim(),
      };
    });
  }

  /** 加载模型并生成一句话，返回用了多少秒，让用户知道在这台手机上有多快。 */
  async check(): Promise<void> {
    await this.trial();
  }

  async trial(): Promise<{ seconds: number; reply: string }> {
    const started = Date.now();
    const today = new Date().toISOString().slice(0, 10);
    const reflection = await this.reflect({
      today,
      entry: {
        id: 0,
        createdAt: new Date().toISOString(),
        day: today,
        content: '晚饭后散步 30 分钟',
        takeaway: '脑子清楚了很多',
        category: null,
        categorySource: null,
        aiReply: null,
        aiStatus: 'none',
      },
      related: [],
      relatedTotal: 0,
      entryNumber: 1,
      growthDays: 1,
    });
    return { seconds: (Date.now() - started) / 1000, reply: reflection.reply };
  }
}
