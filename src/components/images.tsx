import { Image } from 'expo-image';
import { Modal, Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

const THUMB_SIZE = 64;

/** 一排缩略图。onRemove 存在时，每张图右上角有个删除按钮（用在还没保存的记录里）。 */
export function ThumbnailRow({
  uris,
  onOpen,
  onRemove,
}: {
  uris: string[];
  /** 不传就不能点开看大图（比如在记录面板里） */
  onOpen?: (uri: string) => void;
  onRemove?: (index: number) => void;
}) {
  const theme = useTheme();
  if (uris.length === 0) return null;
  return (
    <View style={styles.row}>
      {uris.map((uri, index) => (
        <Pressable
          key={uri}
          accessibilityRole="imagebutton"
          accessibilityLabel="查看图片"
          disabled={!onOpen}
          onPress={() => onOpen?.(uri)}>
          <Image source={{ uri }} style={[styles.thumb, { borderColor: theme.border }]} contentFit="cover" transition={150} />
          {onRemove ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="移除这张图片"
              hitSlop={8}
              onPress={() => onRemove(index)}
              style={[styles.remove, { backgroundColor: theme.text }]}>
              <ThemedText type="caption" style={{ color: theme.background }}>
                ×
              </ThemedText>
            </Pressable>
          ) : null}
        </Pressable>
      ))}
    </View>
  );
}

/** 全屏看一张图，点任意位置关闭。 */
export function ImageViewer({ uri, onClose }: { uri: string | null; onClose: () => void }) {
  return (
    <Modal visible={uri !== null} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.viewer} onPress={onClose} accessibilityLabel="关闭图片">
        {uri ? <Image source={{ uri }} style={styles.full} contentFit="contain" /> : null}
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
  thumb: {
    width: THUMB_SIZE,
    height: THUMB_SIZE,
    borderRadius: Radius.small,
    borderWidth: StyleSheet.hairlineWidth,
  },
  remove: {
    position: 'absolute',
    top: -6,
    right: -6,
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  viewer: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.92)',
    justifyContent: 'center',
  },
  full: {
    width: '100%',
    height: '100%',
  },
});
