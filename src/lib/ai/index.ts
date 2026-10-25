/**
 * AI 见证者：读你的记录，用一两句话点出变化，每周写一份“这周的你”。
 * 背后可以是 Claude，也可以是任何兼容 OpenAI 接口的服务，包括你电脑上的模型。
 */

import Anthropic from '@anthropic-ai/sdk';

import { findLocalModel } from '../local-model';
import { getActiveAiConfig } from '../settings';
import { ClaudeProvider } from './claude';
import { OnDeviceProvider } from './on-device';
import { OpenAICompatibleProvider } from './openai-compatible';
import { DEFAULT_CLAUDE_MODEL, isClaudeModel, PROVIDERS } from './providers';
import {
  type AiProvider,
  AiFormatError,
  AiRefusalError,
  LocalModelMissingError,
  ModelNotFoundError,
  OnDeviceUnavailableError,
  ProviderHttpError,
  ProviderNetworkError,
  ProviderTimeoutError,
} from './types';

export type { AiProvider, Reflection, ReflectionInput, WeeklyDraft, WeeklyInput } from './types';

/** 当前服务商没配好时返回 null。 */
export async function getAiProvider(): Promise<AiProvider | null> {
  const config = await getActiveAiConfig();
  if (!config) return null;
  const kind = PROVIDERS[config.provider].kind;
  if (kind === 'anthropic') {
    if (!config.apiKey) return null;
    return new ClaudeProvider(config.apiKey, isClaudeModel(config.model) ? config.model : DEFAULT_CLAUDE_MODEL);
  }
  if (kind === 'on-device') {
    const localModel = findLocalModel(config.model);
    return localModel ? new OnDeviceProvider(localModel) : null;
  }
  return new OpenAICompatibleProvider(config.baseUrl, config.model, config.apiKey);
}

/** “我的”页里的 AI 设置还没保存时，用正在填的地址和密钥拉取模型列表。 */
export function listModels(baseUrl: string, apiKey: string | null): Promise<string[]> {
  return new OpenAICompatibleProvider(baseUrl, '', apiKey).listModels();
}

function describeStatus(status: number): string {
  if (status === 401 || status === 403) return '密钥不对，或者没有使用权限';
  if (status === 402) return '账户余额不足';
  if (status === 404) return '地址或模型名不对';
  if (status === 429) return '请求太频繁，或者额度用完了';
  if (status >= 500) return '服务暂时出了问题，过一会儿再试';
  return `服务返回了错误（${status}）`;
}

/** 把各种错误翻译成一句用户看得懂的话。 */
export function describeAiError(error: unknown): string {
  if (error instanceof AiRefusalError) return 'AI 这次没有回应这条记录';
  if (error instanceof AiFormatError) return 'AI 的回答格式不对，可以换个模型试试';
  if (error instanceof OnDeviceUnavailableError) return '本地模型要在 Gradatim 安装包里才能运行，Expo Go 里不行';
  if (error instanceof LocalModelMissingError) return '还没有下载本地模型，请在“我的”里下载';
  if (error instanceof ModelNotFoundError) {
    const examples = error.available.slice(0, 3).join('、');
    return `服务那边没有「${error.model}」这个模型${examples ? `，可以用的有：${examples}` : ''}`;
  }
  if (error instanceof ProviderHttpError) return describeStatus(error.status);
  if (error instanceof ProviderTimeoutError) return '等了很久没有回应，过一会儿再试';
  if (error instanceof ProviderNetworkError) return '连不上服务，检查一下地址和网络';
  if (error instanceof Anthropic.AuthenticationError) return '密钥不对，请在“我的”里检查';
  if (error instanceof Anthropic.PermissionDeniedError) return '这个密钥没有使用该模型的权限';
  if (error instanceof Anthropic.NotFoundError) return '找不到这个模型，请在“我的”里换一个';
  if (error instanceof Anthropic.RateLimitError) return '请求太频繁，过一会儿再试';
  if (error instanceof Anthropic.APIConnectionTimeoutError) return '连接超时，过一会儿再试';
  if (error instanceof Anthropic.APIConnectionError) return '连不上 AI 服务，检查一下网络';
  if (error instanceof Anthropic.InternalServerError) return 'AI 服务暂时出了问题，过一会儿再试';
  if (error instanceof Anthropic.APIError) return `AI 服务返回了错误（${error.status ?? '未知'}）`;
  return '出了点问题，过一会儿再试';
}
