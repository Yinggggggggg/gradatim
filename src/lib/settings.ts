/**
 * 设置：普通设置存在本地键值库，AI 密钥存在系统的加密存储里。
 */

import * as SecureStore from 'expo-secure-store';
import Storage from 'expo-sqlite/kv-store';
import { Platform } from 'react-native';

import { isOnDeviceSupported } from './ai/on-device';
import { DEFAULT_CLAUDE_MODEL, isProviderId, PROVIDERS, type ProviderId } from './ai/providers';
import { DEFAULT_LOCAL_MODEL, findLocalModel, isModelDownloaded } from './local-model';

export type ReminderSettings = {
  enabled: boolean;
  hour: number;
  minute: number;
  /** 用户是否已经看过“打开每晚提醒”的邀请（打开或关掉都算）。 */
  prompted: boolean;
};

export type ProviderConfig = {
  baseUrl: string;
  model: string;
};

export type AiSettings = {
  provider: ProviderId;
  /** 每个服务商各自记住地址和模型，来回切换不会丢 */
  configs: Partial<Record<ProviderId, ProviderConfig>>;
};

/** 当前能用的 AI 配置：服务商、地址、模型和密钥都齐了。 */
export type ActiveAiConfig = ProviderConfig & {
  provider: ProviderId;
  apiKey: string | null;
};

const DEFAULT_REMINDER: ReminderSettings = { enabled: false, hour: 21, minute: 30, prompted: false };

const KEYS = {
  reminder: 'settings.reminder',
  ai: 'settings.ai',
};

async function readJson<T extends object>(key: string, fallback: T): Promise<T> {
  const raw = await Storage.getItem(key);
  if (!raw) return fallback;
  try {
    return { ...fallback, ...(JSON.parse(raw) as Partial<T>) };
  } catch {
    return fallback;
  }
}

export function getReminderSettings(): Promise<ReminderSettings> {
  return readJson(KEYS.reminder, DEFAULT_REMINDER);
}

export async function setReminderSettings(settings: ReminderSettings): Promise<void> {
  await Storage.setItem(KEYS.reminder, JSON.stringify(settings));
}

export async function getAiSettings(): Promise<AiSettings> {
  const stored = await readJson<AiSettings & { model?: string }>(KEYS.ai, { provider: 'anthropic', configs: {} });
  const provider = isProviderId(stored.provider) ? stored.provider : 'anthropic';
  const configs = { ...stored.configs };
  // 第一版只存了一个 Claude 模型名
  if (stored.model && !configs.anthropic) configs.anthropic = { baseUrl: '', model: stored.model };
  return { provider, configs };
}

export async function setAiSettings(settings: AiSettings): Promise<void> {
  await Storage.setItem(KEYS.ai, JSON.stringify(settings));
}

/** 某个服务商的地址和模型：用户填过的优先，没填就用预置的。 */
export function resolveProviderConfig(settings: AiSettings, provider: ProviderId): ProviderConfig {
  const saved = settings.configs[provider];
  const defaultModel = provider === 'anthropic' ? DEFAULT_CLAUDE_MODEL : provider === 'device' ? DEFAULT_LOCAL_MODEL : '';
  return {
    baseUrl: saved?.baseUrl?.trim() || PROVIDERS[provider].baseUrl,
    model: saved?.model?.trim() || defaultModel,
  };
}

// 第一版的 Claude 密钥沿用原来的存储名，升级后不用重新填
function keyName(provider: ProviderId): string {
  return provider === 'anthropic' ? 'ai.anthropicApiKey' : `ai.key.${provider}`;
}

/** 读写系统加密存储。网页版只用于开发时预览，没有加密存储，退回到本地键值库。 */
export async function readSecret(name: string): Promise<string | null> {
  return Platform.OS === 'web' ? Storage.getItem(name) : SecureStore.getItemAsync(name);
}

export async function writeSecret(name: string, value: string | null): Promise<void> {
  if (Platform.OS === 'web') {
    if (value) await Storage.setItem(name, value);
    else await Storage.removeItem(name);
    return;
  }
  if (value) await SecureStore.setItemAsync(name, value);
  else await SecureStore.deleteItemAsync(name);
}

export async function getApiKey(provider: ProviderId): Promise<string | null> {
  const key = await readSecret(keyName(provider));
  return key?.trim() ? key.trim() : null;
}

export async function setApiKey(provider: ProviderId, value: string | null): Promise<void> {
  await writeSecret(keyName(provider), value?.trim() || null);
}

/** 当前选中的服务商已经配好就返回它的配置，否则返回 null（记录照常保存，只是没有 AI 回应）。 */
export async function getActiveAiConfig(): Promise<ActiveAiConfig | null> {
  const settings = await getAiSettings();
  const preset = PROVIDERS[settings.provider];
  const { baseUrl, model } = resolveProviderConfig(settings, settings.provider);
  const apiKey = preset.keyMode === 'none' ? null : await getApiKey(settings.provider);
  if (preset.keyMode === 'required' && !apiKey) return null;
  if (preset.kind === 'openai-compatible' && (!baseUrl || !model)) return null;
  if (preset.kind === 'on-device') {
    const localModel = findLocalModel(model);
    if (!localModel || !isOnDeviceSupported() || !isModelDownloaded(localModel)) return null;
  }
  return { provider: settings.provider, baseUrl, model, apiKey };
}
