import { useSQLiteContext } from 'expo-sqlite';
import { useState } from 'react';
import { View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Button, Card, Screen } from '@/components/ui';
import { exportEverything } from '@/lib/export';

export default function DataScreen() {
  const db = useSQLiteContext();
  const [notice, setNotice] = useState<string | null>(null);

  async function exportAll() {
    setNotice(null);
    try {
      const result = await exportEverything(db);
      if (result === 'unavailable') setNotice('这台设备不支持分享文件。');
    } catch {
      setNotice('导出失败，请再试一次。');
    }
  }

  return (
    <Screen underHeader>
      <Card>
        <ThemedText type="subtitle">导出全部记录</ThemedText>
        <ThemedText type="small" themeColor="textSecondary">
          记录、周报和主页文字导出成一个文件，可以存到网盘做备份。图片暂不包含。
        </ThemedText>
        <View>
          <Button title="导出" kind="secondary" onPress={exportAll} />
        </View>
        {notice ? <ThemedText type="caption">{notice}</ThemedText> : null}
      </Card>
      <ThemedText type="caption">所有记录只存在这台手机上。</ThemedText>
    </Screen>
  );
}
