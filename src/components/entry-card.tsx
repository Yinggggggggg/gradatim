import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';
import Animated, { FadeInDown, LinearTransition } from 'react-native-reanimated';

import { MoreIcon, SparkleIcon } from '@/components/icons';
import { ThumbnailRow } from '@/components/images';
import { ThemedText } from '@/components/themed-text';
import { TextButton } from '@/components/ui';
import { Fonts, Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { CATEGORIES } from '@/lib/categories';
import type { Entry } from '@/lib/db';

/** 一条记录：左边是方向的小圆标（点一下改方向），右边是做了什么、收获、图片和 AI 的一句话。长按或点 ··· 打开菜单。 */
export function EntryCard({
  entry,
  index,
  imageUris,
  errorMessage,
  onChangeCategory,
  onRetry,
  onMore,
  onSetupAi,
  onOpenImage,
}: {
  entry: Entry;
  /** 在列表里的位置，越靠后出现得越晚一点 */
  index: number;
  imageUris: string[];
  errorMessage?: string;
  onChangeCategory: () => void;
  onRetry: () => void;
  onMore: () => void;
  onSetupAi: () => void;
  onOpenImage: (uri: string) => void;
}) {
  const theme = useTheme();
  const category = entry.category ? CATEGORIES[entry.category] : null;
  const color = category?.color ?? theme.textSecondary;

  return (
    <Animated.View
      entering={FadeInDown.delay(Math.min(index, 6) * 50).springify().damping(18)}
      layout={LinearTransition.springify().damping(20)}>
      <Pressable
        onLongPress={onMore}
        delayLongPress={350}
        style={[styles.card, { backgroundColor: theme.card, borderColor: theme.border }]}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`方向：${category?.label ?? '未分类'}，点按修改`}
          onPress={onChangeCategory}
          hitSlop={6}
          style={[styles.badge, { backgroundColor: `${color}22` }]}>
          <ThemedText type="smallBold" style={{ color }}>
            {category ? Array.from(category.label)[0] : '·'}
          </ThemedText>
        </Pressable>

        <View style={styles.body}>
          <View style={styles.topLine}>
            <ThemedText style={styles.flex}>{entry.content}</ThemedText>
            <Pressable accessibilityRole="button" accessibilityLabel="更多" onPress={onMore} hitSlop={12}>
              <MoreIcon size={20} color={theme.textSecondary} strokeWidth={2.6} />
            </Pressable>
          </View>
          {entry.takeaway ? (
            <ThemedText type="small" themeColor="textSecondary">
              {entry.takeaway}
            </ThemedText>
          ) : null}
          <ThumbnailRow uris={imageUris} onOpen={onOpenImage} />

          {entry.aiStatus === 'pending' ? (
            <View style={styles.row}>
              <ActivityIndicator size="small" color={theme.accent} />
              <ThemedText type="caption">对照以前的记录…</ThemedText>
            </View>
          ) : null}

          {entry.aiStatus === 'done' && entry.aiReply ? (
            <Animated.View entering={FadeInDown.springify().damping(18)} style={styles.reply}>
              <SparkleIcon size={14} color={theme.accent} strokeWidth={2} />
              <ThemedText type="small" style={styles.replyText}>
                {entry.aiReply}
              </ThemedText>
            </Animated.View>
          ) : null}

          {entry.aiStatus === 'error' ? (
            <View style={styles.row}>
              <ThemedText type="small" style={[styles.flex, { color: theme.danger }]}>
                {errorMessage ?? 'AI 这次没有回应'}
              </ThemedText>
              <TextButton title="重试" onPress={onRetry} />
            </View>
          ) : null}

          {entry.aiStatus === 'skipped' ? (
            <View style={styles.row}>
              <ThemedText type="caption" style={styles.flex}>
                设置好 AI，这里会写出你的变化
              </ThemedText>
              <TextButton title="去设置" onPress={onSetupAi} />
            </View>
          ) : null}
        </View>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.three,
    borderRadius: Radius.large,
    borderWidth: StyleSheet.hairlineWidth,
    paddingVertical: Spacing.three,
    paddingHorizontal: Spacing.three,
  },
  badge: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
  },
  body: {
    flex: 1,
    gap: Spacing.one + 2,
  },
  topLine: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.two,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  flex: {
    flex: 1,
  },
  reply: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.one + 2,
    paddingTop: 2,
  },
  replyText: {
    flex: 1,
    fontFamily: Fonts.serif,
    lineHeight: 21,
  },
});
