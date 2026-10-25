import * as Clipboard from 'expo-clipboard';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { LoginSheet } from '@/components/login-sheet';
import { Sheet } from '@/components/sheet';
import { ThemedText } from '@/components/themed-text';
import { Button, Card, TextButton } from '@/components/ui';
import { Spacing } from '@/constants/theme';
import { useCloudUser } from '@/hooks/use-cloud-user';
import { useTheme } from '@/hooks/use-theme';
import { CloudError, deleteAccount, getMyUid, isCloudConfigured, signOut } from '@/lib/cloud';

/** 复制 UID 后，“已复制”显示多久 */
const COPIED_MS = 2000;

/** “我的”页里的“账号”：登录只用于排行榜，不登录也能用全部记录功能。 */
export function AccountSettings() {
  const theme = useTheme();
  const { user, loading } = useCloudUser();
  const [loggingIn, setLoggingIn] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  // 连同账号一起记，换了账号就不会显示上一个账号的 UID
  const [uid, setUid] = useState<{ userId: string; uid: number } | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!user) return;
    let alive = true;
    getMyUid()
      .then((value) => {
        if (alive && value !== null) setUid({ userId: user.id, uid: value });
      })
      .catch(() => {
        // 没联网时先不显示，下次打开“我的”页再取
      });
    return () => {
      alive = false;
    };
  }, [user]);

  if (!isCloudConfigured() || loading) return null;

  const myUid = user && uid?.userId === user.id ? uid.uid : null;

  async function copyUid() {
    if (myUid === null) return;
    // 网页上浏览器可能不让写剪贴板，那就不显示“已复制”
    if (!(await Clipboard.setStringAsync(String(myUid)))) return;
    setCopied(true);
    setTimeout(() => setCopied(false), COPIED_MS);
  }

  async function remove() {
    setNotice(null);
    try {
      await deleteAccount();
      setNotice('账号已删除。本机的记录都还在。');
    } catch (error) {
      setNotice(error instanceof CloudError ? error.message : '删除失败，请重试');
    }
  }

  return (
    <View style={styles.section}>
      <Card>
        {user ? (
          <>
            <ThemedText type="caption">已登录</ThemedText>
            <ThemedText type="smallBold">{user.email}</ThemedText>
            {myUid !== null ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`UID ${myUid}，点一下复制`}
                onPress={() => void copyUid()}
                hitSlop={8}
                style={({ pressed }) => [styles.uid, pressed && styles.pressed]}>
                <ThemedText type="small" themeColor="textSecondary">
                  UID {myUid}
                </ThemedText>
                <ThemedText type="smallBold" style={{ color: theme.accent }}>
                  {copied ? '已复制' : '复制'}
                </ThemedText>
              </Pressable>
            ) : null}
            <View style={styles.row}>
              <TextButton title="退出登录" tone="muted" onPress={() => void signOut()} />
              <TextButton title="删除账号" tone="danger" onPress={() => setConfirmingDelete(true)} />
            </View>
          </>
        ) : (
          <>
            <ThemedText type="small">登录后可以加入全服排行榜。不登录也能使用全部记录功能。</ThemedText>
            <View style={styles.row}>
              <Button title="用邮箱登录" kind="secondary" onPress={() => setLoggingIn(true)} />
            </View>
          </>
        )}
        {notice ? <ThemedText type="caption">{notice}</ThemedText> : null}
      </Card>
      <ThemedText type="caption">账号只用于排行榜，记录内容不会上传。</ThemedText>

      <LoginSheet visible={loggingIn} onClose={() => setLoggingIn(false)} />
      <Sheet
        visible={confirmingDelete}
        title="删除账号？"
        message="账号和排行榜上的数据会从服务器上删掉，找不回来。手机里的记录不受影响。"
        onClose={() => setConfirmingDelete(false)}
        actions={[{ label: '删除账号', destructive: true, onPress: remove }]}
      />
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
    gap: Spacing.four,
  },
  uid: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: Spacing.two,
  },
  pressed: {
    opacity: 0.6,
  },
});
