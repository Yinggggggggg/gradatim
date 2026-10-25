import { Fonts } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

/** 标签里二级页面的标题栏：和页面同色、没有分隔线，返回箭头是金色。 */
export function useStackOptions() {
  const theme = useTheme();
  return {
    headerStyle: { backgroundColor: theme.background },
    headerTintColor: theme.accent,
    headerTitleStyle: { color: theme.text, fontFamily: Fonts.serif },
    headerShadowVisible: false,
    contentStyle: { backgroundColor: theme.background },
  };
}
