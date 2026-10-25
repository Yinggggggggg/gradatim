import { activateKeepAwakeAsync, deactivateKeepAwake } from 'expo-keep-awake';
import { useRef, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Button, TextButton } from '@/components/ui';
import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { describeAiError } from '@/lib/ai';
import { isOnDeviceSupported, OnDeviceProvider, releaseLocalModel } from '@/lib/ai/on-device';
import { AiFormatError } from '@/lib/ai/types';
import {
  deleteModel,
  DOWNLOAD_SOURCES,
  type DownloadSource,
  downloadModel,
  findLocalModel,
  isModelDownloaded,
  LOCAL_MODELS,
  ModelDownloadError,
  type ModelDownload,
} from '@/lib/local-model';

const KEEP_AWAKE_TAG = 'model-download';

type DownloadState = { modelId: string; percent: number; verifying: boolean };

function downloadedIds(): Set<string> {
  return new Set(LOCAL_MODELS.filter(isModelDownloaded).map((model) => model.id));
}

/** “手机本地模型”的设置：选模型、下载、测速、删除。 */
export function LocalModelSettings({
  modelId,
  onChooseModel,
  onNotice,
}: {
  modelId: string;
  onChooseModel: (id: string) => void;
  onNotice: (notice: string | null) => void;
}) {
  const theme = useTheme();
  const supported = isOnDeviceSupported();
  const [source, setSource] = useState<DownloadSource>('modelscope');
  const [downloaded, setDownloaded] = useState(downloadedIds);
  const [download, setDownload] = useState<DownloadState | null>(null);
  const [testing, setTesting] = useState(false);
  const active = useRef<ModelDownload | null>(null);

  const selected = findLocalModel(modelId) ?? LOCAL_MODELS[0];
  const selectedReady = downloaded.has(selected.id);

  async function start() {
    onNotice(null);
    setDownload({ modelId: selected.id, percent: 0, verifying: false });
    await activateKeepAwakeAsync(KEEP_AWAKE_TAG);
    let lastPercent = 0;
    const handle = downloadModel(
      selected,
      source,
      (fraction) => {
        const percent = Math.floor(fraction * 100);
        if (percent === lastPercent) return;
        lastPercent = percent;
        setDownload((current) => current && { ...current, percent });
      },
      () => setDownload((current) => current && { ...current, verifying: true }),
    );
    active.current = handle;
    try {
      if (await handle.done) onNotice(`${selected.name} 下载好了。点“测试一下”，看看在这台手机上要多久。`);
    } catch (error) {
      onNotice(error instanceof ModelDownloadError ? error.message : '下载失败，请重试');
    } finally {
      active.current = null;
      setDownload(null);
      setDownloaded(downloadedIds());
      await deactivateKeepAwake(KEEP_AWAKE_TAG);
    }
  }

  async function remove() {
    await releaseLocalModel();
    deleteModel(selected);
    setDownloaded(downloadedIds());
    onNotice(`${selected.name} 已删除。`);
  }

  async function test() {
    setTesting(true);
    onNotice('正在加载模型，第一次可能要十几秒…');
    try {
      const { seconds, reply } = await new OnDeviceProvider(selected).trial();
      onNotice(`可以用了。这次用了 ${seconds.toFixed(1)} 秒（刚加载模型时会慢一些），写出的是：「${reply}」`);
    } catch (error) {
      // 格式不对时把模型的原话也显示出来，方便排查
      const raw = error instanceof AiFormatError && error.raw !== undefined ? `模型写的是：「${error.raw || '（空）'}」` : '';
      onNotice(`${describeAiError(error)}${raw ? `。${raw}` : ''}`);
    } finally {
      setTesting(false);
    }
  }

  return (
    <>
      {!supported ? (
        <ThemedText type="small" style={{ color: theme.danger }}>
          现在是在 Expo Go 或网页预览里，运行不了本地模型。装上 Gradatim 安装包后，在这里下载模型就能用。
        </ThemedText>
      ) : null}

      <ThemedText type="smallBold" style={styles.label}>
        模型
      </ThemedText>
      {LOCAL_MODELS.map((model) => {
        const isSelected = model.id === selected.id;
        const isDownloading = download?.modelId === model.id;
        const status = downloaded.has(model.id)
          ? '已下载'
          : isDownloading
            ? download.verifying
              ? '正在校验…'
              : `下载中 ${download.percent}%`
            : '未下载';
        return (
          <Pressable
            key={model.id}
            accessibilityRole="radio"
            accessibilityState={{ selected: isSelected }}
            disabled={download !== null}
            onPress={() => onChooseModel(model.id)}
            style={[styles.option, { borderColor: isSelected ? theme.accent : theme.border }]}>
            <View style={[styles.radio, { borderColor: isSelected ? theme.accent : theme.border }]}>
              {isSelected ? <View style={[styles.radioDot, { backgroundColor: theme.accent }]} /> : null}
            </View>
            <View style={styles.flex}>
              <ThemedText type="smallBold">
                {model.label} · {model.name}
              </ThemedText>
              <ThemedText type="caption">{model.hint}</ThemedText>
              <ThemedText type="caption" style={{ color: theme.accent }}>
                {status}
              </ThemedText>
              {isDownloading ? (
                <View style={[styles.track, { backgroundColor: theme.border }]}>
                  <View style={[styles.bar, { backgroundColor: theme.accent, width: `${download.percent}%` }]} />
                </View>
              ) : null}
            </View>
          </Pressable>
        );
      })}

      {!selectedReady ? (
        <>
          <ThemedText type="smallBold" style={styles.label}>
            下载源
          </ThemedText>
          <View style={styles.chips}>
            {(Object.keys(DOWNLOAD_SOURCES) as DownloadSource[]).map((key) => {
              const chosen = key === source;
              return (
                <Pressable
                  key={key}
                  accessibilityRole="button"
                  accessibilityState={{ selected: chosen }}
                  disabled={download !== null}
                  onPress={() => setSource(key)}
                  style={[
                    styles.chip,
                    { borderColor: chosen ? theme.accent : theme.border },
                    chosen && { backgroundColor: theme.accentSoft },
                  ]}>
                  <ThemedText type="small" style={{ color: chosen ? theme.accent : theme.text }}>
                    {DOWNLOAD_SOURCES[key].label}
                  </ThemedText>
                </Pressable>
              );
            })}
          </View>
          <ThemedText type="caption">建议连着 Wi-Fi 下载，下载时 App 要开着，屏幕会保持常亮。</ThemedText>
        </>
      ) : null}

      <View style={styles.row}>
        {download ? (
          <Button title="取消下载" kind="secondary" onPress={() => active.current?.cancel()} />
        ) : selectedReady ? (
          <>
            <Button title="测试一下" kind="secondary" onPress={test} loading={testing} disabled={!supported} />
            <TextButton title="删除模型" tone="danger" onPress={remove} disabled={testing} />
          </>
        ) : (
          <Button title={`下载${selected.label}模型`} onPress={start} disabled={!supported} />
        )}
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  label: {
    marginTop: Spacing.two,
  },
  flex: {
    flex: 1,
    gap: Spacing.half,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
  },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    borderWidth: 1,
    borderRadius: Radius.medium,
    padding: Spacing.three,
  },
  radio: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  track: {
    height: 6,
    borderRadius: 3,
    overflow: 'hidden',
    marginTop: Spacing.one,
  },
  bar: {
    height: 6,
    borderRadius: 3,
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
  chip: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.one,
  },
});
