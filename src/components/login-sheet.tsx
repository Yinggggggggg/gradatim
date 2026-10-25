import { useEffect, useState } from 'react';
import { StyleSheet, TextInput, View } from 'react-native';

import { Sheet } from '@/components/sheet';
import { ThemedText } from '@/components/themed-text';
import { Button, TextButton } from '@/components/ui';
import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { CloudError, sendLoginCode, verifyLoginCode } from '@/lib/cloud';

const RESEND_SECONDS = 60;
const CODE_LENGTH = 6;

function messageOf(error: unknown): string {
  return error instanceof CloudError ? error.message : '出了点问题，请重试';
}

/** 邮箱验证码登录：先填邮箱收验证码，再填 6 位验证码。不需要密码。 */
export function LoginSheet({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const theme = useTheme();
  const [step, setStep] = useState<'email' | 'code'>('email');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cooldown, setCooldown] = useState(0);

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setTimeout(() => setCooldown((seconds) => seconds - 1), 1000);
    return () => clearTimeout(timer);
  }, [cooldown]);

  function close() {
    setStep('email');
    setCode('');
    setError(null);
    onClose();
  }

  async function send() {
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) {
      setError('邮箱地址好像不对');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await sendLoginCode(email);
      setStep('code');
      setCooldown(RESEND_SECONDS);
    } catch (e) {
      setError(messageOf(e));
    } finally {
      setBusy(false);
    }
  }

  async function verify() {
    setBusy(true);
    setError(null);
    try {
      await verifyLoginCode(email, code);
      close();
    } catch (e) {
      setError(messageOf(e));
    } finally {
      setBusy(false);
    }
  }

  const inputStyle = [styles.input, { color: theme.text, borderColor: theme.border }];

  return (
    <Sheet visible={visible} title={step === 'email' ? '用邮箱登录' : '输入验证码'} onClose={close}>
      {step === 'email' ? (
        <>
          <ThemedText type="small" themeColor="textSecondary">
            会发一个 6 位验证码到你的邮箱，不需要设密码。第一次登录会自动创建账号。
          </ThemedText>
          <TextInput
            value={email}
            onChangeText={setEmail}
            placeholder="you@example.com"
            placeholderTextColor={theme.textSecondary}
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
            autoComplete="email"
            style={inputStyle}
            onSubmitEditing={send}
          />
          <Button title="发送验证码" onPress={send} loading={busy} disabled={!email.trim()} />
        </>
      ) : (
        <>
          <ThemedText type="small" themeColor="textSecondary">
            验证码已经发到 {email.trim()}，几分钟内有效。没收到的话，看看垃圾邮件。
          </ThemedText>
          <TextInput
            value={code}
            onChangeText={(value) => setCode(value.replace(/\D/g, '').slice(0, CODE_LENGTH))}
            placeholder="6 位验证码"
            placeholderTextColor={theme.textSecondary}
            keyboardType="number-pad"
            textContentType="oneTimeCode"
            autoComplete="one-time-code"
            maxLength={CODE_LENGTH}
            style={[inputStyle, styles.code]}
            onSubmitEditing={verify}
          />
          <Button title="登录" onPress={verify} loading={busy} disabled={code.length !== CODE_LENGTH} />
          <View style={styles.row}>
            <TextButton
              title={cooldown > 0 ? `${cooldown} 秒后可以重发` : '重新发送'}
              onPress={send}
              disabled={cooldown > 0 || busy}
            />
            <TextButton
              title="换个邮箱"
              tone="muted"
              onPress={() => {
                setStep('email');
                setCode('');
                setError(null);
              }}
            />
          </View>
        </>
      )}
      {error ? (
        <ThemedText type="small" style={{ color: theme.danger }}>
          {error}
        </ThemedText>
      ) : null}
    </Sheet>
  );
}

const styles = StyleSheet.create({
  input: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: Radius.medium,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    fontSize: 16,
  },
  code: {
    fontSize: 22,
    letterSpacing: 8,
    textAlign: 'center',
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: Spacing.one,
  },
});
