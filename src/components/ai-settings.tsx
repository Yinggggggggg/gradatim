import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';

import { LocalModelSettings } from '@/components/local-model-settings';
import { Sheet } from '@/components/sheet';
import { ThemedText } from '@/components/themed-text';
import { Button, Card, TextButton } from '@/components/ui';
import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { describeAiError, getAiProvider, listModels } from '@/lib/ai';
import { CLAUDE_MODELS, PROVIDER_IDS, PROVIDERS, type ProviderId } from '@/lib/ai/providers';
import {
  type AiSettings,
  getAiSettings,
  getApiKey,
  type ProviderConfig,
  resolveProviderConfig,
  setAiSettings,
  setApiKey,
} from '@/lib/settings';

const BASE_URL_PLACEHOLDER: Partial<Record<ProviderId, string>> = {
  ollama: 'http://192.168.1.10:11434/v1',
  custom: 'https://example.com/v1',
};

function maskKey(key: string): string {
  return key.length <= 8 ? '已保存' : `${key.slice(0, 7)}…${key.slice(-4)}`;
}

export function AiSettingsSection() {
  const theme = useTheme();

  const [settings, setSettings] = useState<AiSettings | null>(null);
  const [form, setForm] = useState<ProviderConfig>({ baseUrl: '', model: '' });
  const [savedKey, setSavedKey] = useState<string | null>(null);
  const [keyInput, setKeyInput] = useState('');
  const [editingKey, setEditingKey] = useState(false);
  const [models, setModels] = useState<string[] | null>(null);
  const [loadingModels, setLoadingModels] = useState(false);
  const [pickingProvider, setPickingProvider] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [checking, setChecking] = useState(false);

  const show = useCallback(async (next: AiSettings) => {
    setSettings(next);
    setForm(resolveProviderConfig(next, next.provider));
    setSavedKey(await getApiKey(next.provider));
    setKeyInput('');
    setEditingKey(false);
    setModels(null);
  }, []);

  useFocusEffect(
    useCallback(() => {
      void getAiSettings().then(show);
    }, [show]),
  );

  if (!settings) return null;

  const provider = settings.provider;
  const preset = PROVIDERS[provider];
  const isClaude = preset.kind === 'anthropic';
  const isDevice = preset.kind === 'on-device';
  const keyForRequests = keyInput.trim() || savedKey;

  async function persist(nextForm: ProviderConfig): Promise<AiSettings> {
    if (!settings) throw new Error('settings not loaded');
    const next: AiSettings = {
      ...settings,
      configs: { ...settings.configs, [provider]: { baseUrl: nextForm.baseUrl.trim(), model: nextForm.model.trim() } },
    };
    await setAiSettings(next);
    setSettings(next);
    return next;
  }

  async function chooseProvider(id: ProviderId) {
    if (!settings) return;
    const next = { ...settings, provider: id };
    await setAiSettings(next);
    await show(next);
    setNotice(null);
  }

  async function chooseModel(model: string) {
    const nextForm = { ...form, model };
    setForm(nextForm);
    await persist(nextForm);
    setNotice(null);
  }

  async function saveAndCheck() {
    await persist(form);
    if (keyInput.trim()) {
      await setApiKey(provider, keyInput);
      setSavedKey(keyInput.trim());
      setKeyInput('');
      setEditingKey(false);
    }
    setChecking(true);
    setNotice(null);
    try {
      const ai = await getAiProvider();
      if (!ai) {
        setNotice(preset.keyMode === 'required' && !keyForRequests ? '还没有填密钥。' : '地址和模型都要填好。');
        return;
      }
      await ai.check();
      setNotice('连接正常，可以用了。');
    } catch (error) {
      setNotice(describeAiError(error));
    } finally {
      setChecking(false);
    }
  }

  async function fetchModels() {
    setLoadingModels(true);
    setNotice(null);
    try {
      const ids = await listModels(form.baseUrl.trim(), keyForRequests);
      if (ids.length === 0) setNotice('服务没有返回模型列表，请手动填写模型名。');
      else setModels(ids);
    } catch (error) {
      setNotice(describeAiError(error));
    } finally {
      setLoadingModels(false);
    }
  }

  async function clearKey() {
    await setApiKey(provider, null);
    setSavedKey(null);
    setNotice('密钥已清除。');
  }

  const inputStyle = [styles.input, { color: theme.text, borderColor: theme.border }];

  return (
    <View style={styles.section}>
      <Card>
        <View style={styles.row}>
          <View style={styles.flex}>
            <ThemedText type="caption">服务商</ThemedText>
            <ThemedText type="smallBold">{preset.label}</ThemedText>
          </View>
          <TextButton title="更换" onPress={() => setPickingProvider(true)} />
        </View>
        <ThemedText type="caption">{preset.hint}</ThemedText>

        {preset.kind === 'openai-compatible' ? (
          <>
            <ThemedText type="smallBold" style={styles.label}>
              接口地址
            </ThemedText>
            <TextInput
              value={form.baseUrl}
              onChangeText={(baseUrl) => setForm({ ...form, baseUrl })}
              placeholder={BASE_URL_PLACEHOLDER[provider] ?? preset.baseUrl}
              placeholderTextColor={theme.textSecondary}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="url"
              style={inputStyle}
            />
          </>
        ) : null}

        {preset.keyMode !== 'none' ? (
          <>
            <ThemedText type="smallBold" style={styles.label}>
              密钥{preset.keyMode === 'optional' ? '（没有可以不填）' : ''}
            </ThemedText>
            {savedKey && !editingKey ? (
              <View style={styles.row}>
                <ThemedText type="small" themeColor="textSecondary" style={styles.flex}>
                  {maskKey(savedKey)}
                </ThemedText>
                <TextButton title="更换" onPress={() => setEditingKey(true)} />
                <TextButton title="清除" tone="danger" onPress={clearKey} />
              </View>
            ) : (
              <TextInput
                value={keyInput}
                onChangeText={setKeyInput}
                placeholder={isClaude ? 'sk-ant-...' : 'sk-...'}
                placeholderTextColor={theme.textSecondary}
                autoCapitalize="none"
                autoCorrect={false}
                secureTextEntry
                style={inputStyle}
              />
            )}
          </>
        ) : null}

        {isDevice ? (
          <LocalModelSettings modelId={form.model} onChooseModel={chooseModel} onNotice={setNotice} />
        ) : (
          <ThemedText type="smallBold" style={styles.label}>
            模型
          </ThemedText>
        )}
        {isDevice ? null : isClaude ? (
          CLAUDE_MODELS.map((option) => {
            const selected = option.id === form.model;
            return (
              <Pressable
                key={option.id}
                accessibilityRole="radio"
                accessibilityState={{ selected }}
                onPress={() => chooseModel(option.id)}
                style={[styles.option, { borderColor: selected ? theme.accent : theme.border }]}>
                <View style={[styles.radio, { borderColor: selected ? theme.accent : theme.border }]}>
                  {selected ? <View style={[styles.radioDot, { backgroundColor: theme.accent }]} /> : null}
                </View>
                <View style={styles.flex}>
                  <ThemedText type="smallBold">{option.label}</ThemedText>
                  <ThemedText type="caption">{option.hint}</ThemedText>
                </View>
              </Pressable>
            );
          })
        ) : (
          <>
            <TextInput
              value={form.model}
              onChangeText={(model) => setForm({ ...form, model })}
              placeholder="模型名"
              placeholderTextColor={theme.textSecondary}
              autoCapitalize="none"
              autoCorrect={false}
              style={inputStyle}
            />
            <TextButton
              title={loadingModels ? '正在获取…' : '从服务商获取可用模型'}
              onPress={fetchModels}
              disabled={loadingModels || !form.baseUrl.trim()}
            />
          </>
        )}

        {isDevice ? null : (
          <View style={styles.row}>
            <Button title="保存并测试连接" kind="secondary" onPress={saveAndCheck} loading={checking} />
          </View>
        )}
        {notice ? <ThemedText type="caption">{notice}</ThemedText> : null}
      </Card>

      <Sheet visible={pickingProvider} title="选择服务商" onClose={() => setPickingProvider(false)}>
        <ScrollView style={styles.sheetList}>
          {PROVIDER_IDS.map((id) => {
            const selected = id === provider;
            return (
              <Pressable
                key={id}
                accessibilityRole="button"
                accessibilityState={{ selected }}
                onPress={() => {
                  setPickingProvider(false);
                  void chooseProvider(id);
                }}
                style={({ pressed }) => [
                  styles.sheetItem,
                  { borderColor: theme.border },
                  selected && { backgroundColor: theme.accentSoft },
                  pressed && styles.pressed,
                ]}>
                <ThemedText type="smallBold">{PROVIDERS[id].label}</ThemedText>
                <ThemedText type="caption">{PROVIDERS[id].hint}</ThemedText>
              </Pressable>
            );
          })}
        </ScrollView>
      </Sheet>

      <Sheet visible={models !== null} title="选择模型" onClose={() => setModels(null)}>
        <ScrollView style={styles.sheetList}>
          {(models ?? []).map((id) => (
            <Pressable
              key={id}
              accessibilityRole="button"
              onPress={() => {
                setModels(null);
                void chooseModel(id);
              }}
              style={({ pressed }) => [
                styles.sheetItem,
                { borderColor: theme.border },
                id === form.model && { backgroundColor: theme.accentSoft },
                pressed && styles.pressed,
              ]}>
              <ThemedText type="small">{id}</ThemedText>
            </Pressable>
          ))}
        </ScrollView>
      </Sheet>
      <ThemedText type="caption">密钥只存在这台手机的加密存储里。</ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    gap: Spacing.two,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
  },
  flex: {
    flex: 1,
  },
  label: {
    marginTop: Spacing.two,
  },
  input: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: Radius.medium,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    fontSize: 16,
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
  sheetList: {
    maxHeight: 420,
  },
  sheetItem: {
    paddingVertical: Spacing.two,
    paddingHorizontal: Spacing.two,
    borderTopWidth: StyleSheet.hairlineWidth,
    gap: Spacing.half,
  },
  pressed: {
    opacity: 0.6,
  },
});
