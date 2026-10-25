import { StyleSheet, View } from 'react-native';

import { Grail } from '@/components/grail';
import { ThemedText } from '@/components/themed-text';
import { Screen } from '@/components/ui';
import { Fonts, Spacing } from '@/constants/theme';

export default function AboutScreen() {
  return (
    <Screen underHeader>
      <View style={styles.hero}>
        <Grail days={100} size={88} />
        <ThemedText type="title">Gradatim</ThemedText>
        <ThemedText type="caption">一步一步 · 日日新</ThemedText>
      </View>
      <ThemedText style={styles.body}>
        Gradatim 是拉丁语，意思是“一步一步地”。中世纪有人这样解释“圣杯”这个词：盘里的美食会一道接一道地端上来，让享用的人满心欢喜。
      </ThemedText>
      <ThemedText style={styles.body}>愿望不靠许愿机。一步一步，用你自己的力量实现。</ThemedText>
    </Screen>
  );
}

const styles = StyleSheet.create({
  hero: {
    alignItems: 'center',
    gap: Spacing.two,
    paddingVertical: Spacing.four,
  },
  body: {
    fontFamily: Fonts.serif,
    lineHeight: 28,
  },
});
