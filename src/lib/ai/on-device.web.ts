/**
 * 网页预览里没有 llama.rn 的原生模块，本地模型一律不可用。
 */

import type { LocalModel } from '../local-model';
import {
  type AiProvider,
  OnDeviceUnavailableError,
  type Reflection,
  type WeeklyDraft,
} from './types';

export function isOnDeviceSupported(): boolean {
  return false;
}

export async function releaseLocalModel(): Promise<void> {}

export class OnDeviceProvider implements AiProvider {
  constructor(readonly model: LocalModel) {}

  reflect(): Promise<Reflection> {
    return Promise.reject(new OnDeviceUnavailableError());
  }

  writeWeekly(): Promise<WeeklyDraft> {
    return Promise.reject(new OnDeviceUnavailableError());
  }

  check(): Promise<void> {
    return Promise.reject(new OnDeviceUnavailableError());
  }

  trial(): Promise<{ seconds: number; reply: string }> {
    return Promise.reject(new OnDeviceUnavailableError());
  }
}
