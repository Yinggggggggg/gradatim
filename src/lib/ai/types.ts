import type { CategoryKey } from '../categories';
import type { Entry } from '../db';

export type ReflectionInput = {
  today: string;
  entry: Entry;
  /** 相关的旧记录，从早到晚 */
  related: Entry[];
  /** 相关旧记录一共多少条（related 可能只是其中一部分） */
  relatedTotal: number;
  /** 这是第几条记录 */
  entryNumber: number;
  growthDays: number;
};

/** category 为 null 表示模型没给出可用的方向，保留原来的分类。 */
export type Reflection = { category: CategoryKey | null; reply: string };

export type WeeklyInput = {
  weekStart: string;
  weekEntries: Entry[];
  /** 这周以前的相关记录，从早到晚 */
  earlier: Entry[];
  growthDays: number;
};

export type WeeklyDraft = { summary: string; highlights: string[]; comparison: string };

/** 每个服务商实现这三件事，其余代码不关心背后是谁。 */
export interface AiProvider {
  reflect(input: ReflectionInput): Promise<Reflection>;
  writeWeekly(input: WeeklyInput): Promise<WeeklyDraft>;
  /** 检查地址、密钥和模型能不能用 */
  check(): Promise<void>;
}

export class AiRefusalError extends Error {
  constructor() {
    super('AI 这次没有回应');
    this.name = 'AiRefusalError';
  }
}

export class AiFormatError extends Error {
  /** raw 是模型实际写出来的内容，排查问题时显示给用户看 */
  constructor(readonly raw?: string) {
    super('AI 的回答格式不对');
    this.name = 'AiFormatError';
  }
}

export class ProviderHttpError extends Error {
  constructor(readonly status: number) {
    super(`服务返回了 ${status}`);
    this.name = 'ProviderHttpError';
  }
}

export class ProviderNetworkError extends Error {
  constructor() {
    super('连不上服务');
    this.name = 'ProviderNetworkError';
  }
}

export class ProviderTimeoutError extends Error {
  constructor() {
    super('等待回应超时');
    this.name = 'ProviderTimeoutError';
  }
}

export class OnDeviceUnavailableError extends Error {
  constructor() {
    super('这个版本的 App 不能运行本地模型');
    this.name = 'OnDeviceUnavailableError';
  }
}

export class LocalModelMissingError extends Error {
  constructor() {
    super('还没有下载本地模型');
    this.name = 'LocalModelMissingError';
  }
}

export class ModelNotFoundError extends Error {
  constructor(
    readonly model: string,
    readonly available: string[],
  ) {
    super(`没有 ${model} 这个模型`);
    this.name = 'ModelNotFoundError';
  }
}
