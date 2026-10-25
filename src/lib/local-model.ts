/**
 * 手机本地模型的下载和管理。模型文件放在 App 自己的文档目录里，卸载 App 时一起删掉。
 */

import { Directory, DownloadTask, File, Paths } from 'expo-file-system';

export const LOCAL_MODELS = [
  {
    id: 'qwen3-1.7b',
    label: '标准',
    name: 'Qwen3 1.7B',
    file: 'Qwen3-1.7B-Q4_K_M.gguf',
    bytes: 1_107_409_472,
    sha256: 'b139949c5bd74937ad8ed8c8cf3d9ffb1e99c866c823204dc42c0d91fa181897',
    repo: 'unsloth/Qwen3-1.7B-GGUF',
    hint: '约 1.1GB，回应更准确，手机内存最好有 6GB 以上',
  },
  {
    id: 'qwen3-0.6b',
    label: '轻量',
    name: 'Qwen3 0.6B',
    file: 'Qwen3-0.6B-Q4_K_M.gguf',
    bytes: 396_705_472,
    sha256: 'ac2d97712095a558e31573f62f466a3f9d93990898b0ec79d7c974c1780d524a',
    repo: 'unsloth/Qwen3-0.6B-GGUF',
    hint: '约 0.4GB，更快，但回应会简单一些',
  },
] as const;

export type LocalModel = (typeof LOCAL_MODELS)[number];
export type LocalModelId = LocalModel['id'];

export const DEFAULT_LOCAL_MODEL: LocalModelId = 'qwen3-1.7b';

export const DOWNLOAD_SOURCES = {
  modelscope: {
    label: 'ModelScope（国内快）',
    url: (m: LocalModel) => `https://modelscope.cn/models/${m.repo}/resolve/master/${m.file}`,
  },
  huggingface: {
    label: 'Hugging Face',
    url: (m: LocalModel) => `https://huggingface.co/${m.repo}/resolve/main/${m.file}`,
  },
} as const;

export type DownloadSource = keyof typeof DOWNLOAD_SOURCES;

export function findLocalModel(id: string): LocalModel | null {
  return LOCAL_MODELS.find((model) => model.id === id) ?? null;
}

function modelsDirectory(): Directory {
  const directory = new Directory(Paths.document, 'models');
  if (!directory.exists) directory.create({ intermediates: true });
  return directory;
}

export function modelFile(model: LocalModel): File {
  return new File(modelsDirectory(), model.file);
}

function partialFile(model: LocalModel): File {
  return new File(modelsDirectory(), `${model.file}.partial`);
}

/** 文件在、大小对得上，就当作下载好了（完整性在下载完成时已经用 SHA-256 校验过）。 */
export function isModelDownloaded(model: LocalModel): boolean {
  try {
    const file = modelFile(model);
    return file.exists && file.size === model.bytes;
  } catch {
    // 网页预览没有应用文档目录
    return false;
  }
}

export function deleteModel(model: LocalModel): void {
  for (const file of [modelFile(model), partialFile(model)]) {
    if (file.exists) file.delete();
  }
}

export class ModelDownloadError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ModelDownloadError';
  }
}

export type ModelDownload = {
  /** 下载并校验成功时为 true，被取消时为 false，失败时抛出 ModelDownloadError。 */
  done: Promise<boolean>;
  cancel: () => void;
};

/** 先下载到 .partial 文件，大小和 SHA-256 都对上之后再改成正式文件名。 */
export function downloadModel(
  model: LocalModel,
  source: DownloadSource,
  onProgress: (fraction: number) => void,
  onVerifying: () => void,
): ModelDownload {
  const partial = partialFile(model);
  if (partial.exists) partial.delete();
  const task = new DownloadTask(DOWNLOAD_SOURCES[source].url(model), partial);
  const subscription = task.addListener('progress', ({ bytesWritten }) => {
    onProgress(Math.min(1, bytesWritten / model.bytes));
  });
  let cancelled = false;

  const done = (async () => {
    try {
      const file = await task.downloadAsync();
      if (!file) return false;
      onVerifying();
      if (file.size !== model.bytes || (await file.digest('SHA-256')) !== model.sha256) {
        throw new ModelDownloadError('下载的文件不完整，请重试');
      }
      const target = modelFile(model);
      if (target.exists) target.delete();
      await file.move(target);
      return true;
    } catch (error) {
      if (partial.exists) partial.delete();
      if (cancelled) return false;
      throw error instanceof ModelDownloadError
        ? error
        : new ModelDownloadError('下载失败，检查网络后重试，或者换一个下载源');
    } finally {
      subscription.remove();
      task.release();
    }
  })();

  return {
    done,
    cancel: () => {
      cancelled = true;
      task.cancel();
    },
  };
}
