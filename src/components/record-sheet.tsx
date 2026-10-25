import { useState } from 'react';
import { KeyboardAvoidingView, Modal, Platform, Pressable, StyleSheet, TextInput, View } from 'react-native';
import Animated, { FadeIn, SlideInDown } from 'react-native-reanimated';

import { CameraIcon, ImageIcon } from '@/components/icons';
import { ThumbnailRow } from '@/components/images';
import { PressableScale } from '@/components/pressable-scale';
import { ThemedText } from '@/components/themed-text';
import { Hero, MaxContentWidth, Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { MAX_IMAGES_PER_ENTRY, type PickedImage, pickFromLibrary, takePhoto } from '@/lib/attachments';

/** 网页预览只用来开发，没有存图片的地方 */
const IMAGES_SUPPORTED = Platform.OS !== 'web';

export type RecordDraft = { content: string; takeaway: string; images: PickedImage[] };

/** 点“＋”弹出的记录面板。记下来之后清空，关掉不清，下次打开还在。 */
export function RecordSheet({
  visible,
  onClose,
  onSave,
}: {
  visible: boolean;
  onClose: () => void;
  onSave: (draft: RecordDraft) => void;
}) {
  const theme = useTheme();
  const [content, setContent] = useState('');
  const [takeaway, setTakeaway] = useState('');
  const [showTakeaway, setShowTakeaway] = useState(false);
  const [images, setImages] = useState<PickedImage[]>([]);
  const [notice, setNotice] = useState<string | null>(null);

  async function addImages(source: 'camera' | 'library') {
    setNotice(null);
    try {
      const picked = source === 'camera' ? await takePhoto() : await pickFromLibrary(MAX_IMAGES_PER_ENTRY - images.length);
      if (picked === 'denied') {
        setNotice('相机权限没有打开，可以在系统设置里允许。');
        return;
      }
      setImages((current) => [...current, ...picked].slice(0, MAX_IMAGES_PER_ENTRY));
    } catch {
      setNotice('没能打开相册或相机，请重试。');
    }
  }

  function save() {
    const text = content.trim();
    if (!text) return;
    onSave({ content: text, takeaway: takeaway.trim(), images });
    setContent('');
    setTakeaway('');
    setShowTakeaway(false);
    setImages([]);
    setNotice(null);
  }

  const inputStyle = [styles.input, { color: theme.text, borderColor: theme.border, backgroundColor: theme.background }];
  const canAddImages = IMAGES_SUPPORTED && images.length < MAX_IMAGES_PER_ENTRY;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose} statusBarTranslucent>
      <KeyboardAvoidingView behavior="padding" style={styles.fill}>
        <Pressable style={styles.backdrop} onPress={onClose} accessibilityLabel="关闭" />
        <Animated.View
          entering={SlideInDown.springify().damping(20).stiffness(180)}
          style={[styles.panel, { backgroundColor: theme.card }]}>
          <View style={[styles.handle, { backgroundColor: theme.border }]} />
          <ThemedText type="caption">今天让自己变好的一件事</ThemedText>
          <TextInput
            value={content}
            onChangeText={setContent}
            placeholder="晚饭后散步 30 分钟"
            placeholderTextColor={theme.textSecondary}
            multiline
            autoFocus
            style={[inputStyle, styles.mainInput]}
          />
          {showTakeaway ? (
            <Animated.View entering={FadeIn.duration(200)}>
              <TextInput
                value={takeaway}
                onChangeText={setTakeaway}
                placeholder="一句收获"
                placeholderTextColor={theme.textSecondary}
                autoFocus
                style={inputStyle}
              />
            </Animated.View>
          ) : null}
          <ThumbnailRow
            uris={images.map((image) => image.uri)}
            onRemove={(index) => setImages((current) => current.filter((_, i) => i !== index))}
          />
          <View style={styles.tools}>
            {!showTakeaway ? (
              <PressableScale
                accessibilityRole="button"
                onPress={() => setShowTakeaway(true)}
                style={[styles.pill, { borderColor: theme.border }]}>
                <ThemedText type="small" themeColor="textSecondary">
                  ＋ 一句收获
                </ThemedText>
              </PressableScale>
            ) : null}
            {canAddImages ? (
              <>
                <PressableScale
                  accessibilityRole="button"
                  accessibilityLabel="拍照"
                  onPress={() => void addImages('camera')}
                  style={[styles.round, { borderColor: theme.border }]}>
                  <CameraIcon size={20} color={theme.textSecondary} />
                </PressableScale>
                <PressableScale
                  accessibilityRole="button"
                  accessibilityLabel="从相册选图片"
                  onPress={() => void addImages('library')}
                  style={[styles.round, { borderColor: theme.border }]}>
                  <ImageIcon size={20} color={theme.textSecondary} />
                </PressableScale>
              </>
            ) : null}
          </View>
          {notice ? <ThemedText type="caption">{notice}</ThemedText> : null}
          <PressableScale
            accessibilityRole="button"
            accessibilityState={{ disabled: !content.trim() }}
            onPress={save}
            haptic={false}
            scaleTo={0.97}
            style={[styles.save, !content.trim() && styles.disabled]}>
            <ThemedText style={styles.saveText}>记下来</ThemedText>
          </PressableScale>
        </Animated.View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  fill: {
    flex: 1,
    justifyContent: 'flex-end',
    alignItems: 'center',
  },
  backdrop: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(20, 14, 8, 0.55)',
  },
  panel: {
    width: '100%',
    maxWidth: MaxContentWidth,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: Spacing.four,
    paddingTop: Spacing.three,
    paddingBottom: Spacing.five,
    gap: Spacing.three,
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    alignSelf: 'center',
  },
  input: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: Radius.medium,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two + 2,
    fontSize: 16,
  },
  mainInput: {
    minHeight: 96,
    fontSize: 17,
    lineHeight: 25,
    textAlignVertical: 'top',
  },
  tools: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  pill: {
    height: 44,
    paddingHorizontal: Spacing.three,
    borderRadius: 22,
    borderWidth: 1,
    justifyContent: 'center',
  },
  round: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  save: {
    height: 52,
    borderRadius: 26,
    backgroundColor: Hero.goldDeep,
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveText: {
    color: Hero.onGold,
    fontSize: 17,
    fontWeight: 700,
  },
  disabled: {
    opacity: 0.45,
  },
});
