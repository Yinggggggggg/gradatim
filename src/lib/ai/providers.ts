/**
 * 可选的 AI 服务商。除了 Claude，其余都走兼容 OpenAI 的接口，所以只预置接口地址；
 * 模型名各家换得很快，填好密钥后从服务商那里实时拉取列表来选。
 */

export const PROVIDER_IDS = ['anthropic', 'device', 'deepseek', 'qwen', 'zhipu', 'moonshot', 'ollama', 'custom'] as const;

export type ProviderId = (typeof PROVIDER_IDS)[number];

export type ProviderPreset = {
  label: string;
  kind: 'anthropic' | 'on-device' | 'openai-compatible';
  /** 预置的接口地址；电脑上的模型和自定义服务需要自己填 */
  baseUrl: string;
  keyMode: 'required' | 'optional' | 'none';
  hint: string;
};

export const PROVIDERS: Record<ProviderId, ProviderPreset> = {
  anthropic: {
    label: 'Claude',
    kind: 'anthropic',
    baseUrl: '',
    keyMode: 'required',
    hint: '在 console.anthropic.com 申请密钥',
  },
  device: {
    label: '手机本地模型',
    kind: 'on-device',
    baseUrl: '',
    keyMode: 'none',
    hint: '不联网、不花钱，记录不离开手机。需要先下载模型（约 0.4–1.1GB），回应要等几秒到十几秒',
  },
  deepseek: {
    label: 'DeepSeek',
    kind: 'openai-compatible',
    baseUrl: 'https://api.deepseek.com',
    keyMode: 'required',
    hint: '在 platform.deepseek.com 申请密钥',
  },
  qwen: {
    label: '通义千问',
    kind: 'openai-compatible',
    baseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
    keyMode: 'required',
    hint: '在阿里云百炼控制台申请密钥',
  },
  zhipu: {
    label: '智谱 GLM',
    kind: 'openai-compatible',
    baseUrl: 'https://open.bigmodel.cn/api/paas/v4',
    keyMode: 'required',
    hint: '在 bigmodel.cn 申请密钥，有免费的 Flash 模型',
  },
  moonshot: {
    label: 'Kimi',
    kind: 'openai-compatible',
    baseUrl: 'https://api.moonshot.cn/v1',
    keyMode: 'required',
    hint: '在 platform.moonshot.cn 申请密钥',
  },
  ollama: {
    label: '电脑上的模型（Ollama）',
    kind: 'openai-compatible',
    baseUrl: '',
    keyMode: 'none',
    hint: '数据不出家门，也不花钱。地址填 http://电脑的局域网 IP:11434/v1，手机和电脑要连同一个 Wi-Fi',
  },
  custom: {
    label: '自定义',
    kind: 'openai-compatible',
    baseUrl: '',
    keyMode: 'optional',
    hint: '任何兼容 OpenAI 接口的服务，比如 OpenRouter、硅基流动、LM Studio',
  },
};

export const CLAUDE_MODELS = [
  { id: 'claude-opus-5-5', label: 'Opus 5.5', hint: '默认，最强' },
  { id: 'claude-sonnet-5-5', label: 'Sonnet 5.5', hint: '费用约为 Opus 的一半' },
  { id: 'claude-haiku-5-5', label: 'Haiku 5.5', hint: '最省钱，约为 Opus 的四十分之一' },
] as const;

export type ClaudeModel = (typeof CLAUDE_MODELS)[number]['id'];

export const DEFAULT_CLAUDE_MODEL: ClaudeModel = 'claude-opus-5-5';

export function isClaudeModel(value: string): value is ClaudeModel {
  return CLAUDE_MODELS.some((model) => model.id === value);
}

export function isProviderId(value: unknown): value is ProviderId {
  return typeof value === 'string' && (PROVIDER_IDS as readonly string[]).includes(value);
}
