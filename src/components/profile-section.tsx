import { useFocusEffect } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';

import { Avatar } from '@/components/avatar';
import { PRESET_LABELS, ProfileBackgroundView } from '@/components/profile-background';
import { Sheet } from '@/components/sheet';
import { ThemedText } from '@/components/themed-text';
import { TextButton } from '@/components/ui';
import { Fonts, Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { syncAvatar, syncGrowth } from '@/lib/leaderboard';
import {
  BACKGROUND_PRESETS,
  type BackgroundPreset,
  getProfile,
  GOAL_MAX,
  MAX_GOALS,
  MOTTO_MAX,
  NICKNAME_MAX,
  type Profile,
  saveProfile,
} from '@/lib/profile';
import type { ImageSource } from '@/lib/profile-image-prepare';
import { CAMERA_SUPPORTED, deleteProfileImage, pickProfileImage, profileImageUri } from '@/lib/profile-images';

const BANNER_HEIGHT = 140;
const AVATAR_SIZE = 84;
/** 头像外面一圈卡片底色，叠在背景上更清楚 */
const AVATAR_RING = 4;

type Draft = { nickname: string; motto: string; goals: string[] };

/** “我的”页顶部的个人主页：背景、头像、昵称、箴言和目标。只给自己看，存在这台手机上。 */
export function ProfileSection() {
  const db = useSQLiteContext();
  const theme = useTheme();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [editing, setEditing] = useState<'text' | 'avatar' | 'background' | null>(null);
  const [draft, setDraft] = useState<Draft>({ nickname: '', motto: '', goals: [] });
  const [notice, setNotice] = useState<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      void getProfile().then(setProfile);
    }, []),
  );

  if (!profile) return null;
  const current = profile;

  async function update(next: Profile): Promise<Profile> {
    const saved = await saveProfile(next);
    setProfile(saved);
    return saved;
  }

  function openTextEditor() {
    setDraft({
      nickname: current.nickname,
      motto: current.motto,
      goals: Array.from({ length: MAX_GOALS }, (_, i) => current.goals[i] ?? ''),
    });
    setEditing('text');
  }

  async function saveText() {
    const saved = await update({ ...current, ...draft });
    // 已经加入排行榜的话，排行榜上的昵称跟着改
    if (saved.nickname !== current.nickname) void syncGrowth(db);
  }

  async function pickImage(kind: 'avatar' | 'background', source: ImageSource): Promise<string | null> {
    setNotice(null);
    try {
      const image = await pickProfileImage(kind, source);
      if (image === 'denied') {
        setNotice('相机权限没有打开，可以在系统设置里允许。');
        return null;
      }
      return image;
    } catch {
      setNotice('没能打开相册或相机，请重试。');
      return null;
    }
  }

  async function setAvatar(image: string | null) {
    await update({ ...current, avatar: image });
    if (current.avatar) deleteProfileImage(current.avatar);
    // 加入了排行榜才会上传；传不上去下次打开排行榜会再试
    void syncAvatar().catch(() => undefined);
  }

  async function changeAvatar(source: ImageSource) {
    const image = await pickImage('avatar', source);
    if (image) await setAvatar(image);
  }

  async function setBackground(background: Profile['background']) {
    await update({ ...current, background });
    if (current.background.kind === 'photo') deleteProfileImage(current.background.image);
  }

  async function choosePreset(preset: BackgroundPreset) {
    setEditing(null);
    await setBackground({ kind: 'preset', preset });
  }

  async function uploadBackground() {
    const image = await pickImage('background', 'library');
    if (image) await setBackground({ kind: 'photo', image });
  }

  const inputStyle = [styles.input, { color: theme.text, borderColor: theme.border, backgroundColor: theme.background }];
  const empty = !current.motto && current.goals.length === 0;

  return (
    <View style={[styles.card, { backgroundColor: theme.card, borderColor: theme.border }]}>
      <View style={styles.banner}>
        <ProfileBackgroundView background={current.background} />
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="换背景"
          onPress={() => setEditing('background')}
          hitSlop={8}
          style={({ pressed }) => [styles.bannerButton, pressed && styles.pressed]}>
          <ThemedText type="caption" style={styles.bannerButtonText}>
            换背景
          </ThemedText>
        </Pressable>
      </View>

      <View style={styles.body}>
        <View style={styles.topRow}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="换头像"
            onPress={() => setEditing('avatar')}
            style={({ pressed }) => [styles.avatarRing, { backgroundColor: theme.card }, pressed && styles.pressed]}>
            <Avatar
              uri={current.avatar ? profileImageUri(current.avatar) : null}
              name={current.nickname}
              size={AVATAR_SIZE}
            />
          </Pressable>
          <TextButton title="编辑主页" onPress={openTextEditor} />
        </View>

        <ThemedText type="subtitle" numberOfLines={1}>
          {current.nickname || '还没有昵称'}
        </ThemedText>
        {current.motto ? (
          <ThemedText style={[styles.motto, { color: theme.textSecondary }]}>「{current.motto}」</ThemedText>
        ) : null}
        {current.goals.length > 0 ? (
          <View style={styles.goals}>
            {current.goals.map((goal, index) => (
              <View key={`${index}-${goal}`} style={styles.goalRow}>
                <View style={[styles.goalMark, { borderColor: theme.accent }]} />
                <ThemedText type="small" style={styles.flex}>
                  {goal}
                </ThemedText>
              </View>
            ))}
          </View>
        ) : null}
        {empty ? (
          <ThemedText type="small" themeColor="textSecondary">
            写一句箴言、几个目标，提醒自己为什么出发。主页只有你自己看得到。
          </ThemedText>
        ) : null}
        {notice ? <ThemedText type="caption">{notice}</ThemedText> : null}
      </View>

      <Sheet
        visible={editing === 'text'}
        title="编辑主页"
        onClose={() => setEditing(null)}
        actions={[{ label: '保存', onPress: () => void saveText() }]}>
        <ScrollView style={styles.editor} contentContainerStyle={styles.editorContent} keyboardShouldPersistTaps="handled">
          <ThemedText type="smallBold">昵称</ThemedText>
          <TextInput
            value={draft.nickname}
            onChangeText={(nickname) => setDraft({ ...draft, nickname })}
            placeholder="加入排行榜后也用这个名字"
            placeholderTextColor={theme.textSecondary}
            maxLength={NICKNAME_MAX}
            style={inputStyle}
          />
          <ThemedText type="smallBold">箴言</ThemedText>
          <TextInput
            value={draft.motto}
            onChangeText={(motto) => setDraft({ ...draft, motto })}
            placeholder="比如：苟日新，日日新，又日新"
            placeholderTextColor={theme.textSecondary}
            maxLength={MOTTO_MAX}
            style={inputStyle}
          />
          <ThemedText type="smallBold">目标（最多 {MAX_GOALS} 条）</ThemedText>
          {draft.goals.map((goal, index) => (
            <TextInput
              key={index}
              value={goal}
              onChangeText={(text) => setDraft({ ...draft, goals: draft.goals.map((g, i) => (i === index ? text : g)) })}
              placeholder={index === 0 ? '比如：今年读完 12 本书' : `目标 ${index + 1}`}
              placeholderTextColor={theme.textSecondary}
              maxLength={GOAL_MAX}
              style={inputStyle}
            />
          ))}
        </ScrollView>
      </Sheet>

      <Sheet
        visible={editing === 'avatar'}
        title="头像"
        message="头像存在这台手机上。加入排行榜后，排行榜上也会显示它。"
        onClose={() => setEditing(null)}
        actions={[
          { label: '从相册选择', onPress: () => void changeAvatar('library') },
          ...(CAMERA_SUPPORTED ? [{ label: '拍照', onPress: () => void changeAvatar('camera') }] : []),
          ...(current.avatar ? [{ label: '去掉头像', destructive: true, onPress: () => void setAvatar(null) }] : []),
        ]}
      />

      <Sheet
        visible={editing === 'background'}
        title="背景"
        message="只在你自己的主页上显示，不会上传。"
        onClose={() => setEditing(null)}
        actions={[{ label: '用自己的照片', onPress: () => void uploadBackground() }]}>
        <View style={styles.presets}>
          {BACKGROUND_PRESETS.map((preset) => {
            const selected = current.background.kind === 'preset' && current.background.preset === preset;
            return (
              <Pressable
                key={preset}
                accessibilityRole="button"
                accessibilityState={{ selected }}
                onPress={() => void choosePreset(preset)}
                style={({ pressed }) => [styles.preset, pressed && styles.pressed]}>
                <View style={[styles.presetArt, { borderColor: selected ? theme.accent : theme.border }]}>
                  <ProfileBackgroundView background={{ kind: 'preset', preset }} />
                </View>
                <ThemedText type="caption" style={selected ? { color: theme.accent } : undefined}>
                  {PRESET_LABELS[preset]}
                </ThemedText>
              </Pressable>
            );
          })}
        </View>
      </Sheet>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: Radius.large,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
  },
  banner: {
    height: BANNER_HEIGHT,
  },
  bannerButton: {
    position: 'absolute',
    top: Spacing.two,
    right: Spacing.two,
    paddingHorizontal: Spacing.two,
    paddingVertical: Spacing.one,
    borderRadius: 999,
    backgroundColor: 'rgba(0, 0, 0, 0.35)',
  },
  bannerButtonText: {
    color: '#FFFFFF',
  },
  body: {
    paddingHorizontal: Spacing.three,
    paddingBottom: Spacing.three,
    gap: Spacing.two,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    marginTop: -(AVATAR_SIZE / 2 + AVATAR_RING),
  },
  avatarRing: {
    padding: AVATAR_RING,
    borderRadius: AVATAR_SIZE,
  },
  motto: {
    fontFamily: Fonts.serif,
    fontSize: 16,
    lineHeight: 24,
  },
  goals: {
    gap: Spacing.one,
  },
  goalRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  goalMark: {
    width: 8,
    height: 8,
    borderWidth: 1.5,
    transform: [{ rotate: '45deg' }],
  },
  flex: {
    flex: 1,
  },
  pressed: {
    opacity: 0.7,
  },
  editor: {
    maxHeight: 380,
  },
  editorContent: {
    gap: Spacing.two,
  },
  input: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: Radius.medium,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    fontSize: 16,
  },
  presets: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
  preset: {
    width: '31%',
    alignItems: 'center',
    gap: Spacing.one,
  },
  presetArt: {
    width: '100%',
    aspectRatio: 16 / 9,
    borderRadius: Radius.small,
    borderWidth: 2,
    overflow: 'hidden',
  },
});
