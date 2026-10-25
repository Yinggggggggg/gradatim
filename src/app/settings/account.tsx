import { AccountSettings } from '@/components/account-settings';
import { Screen } from '@/components/ui';

export default function AccountScreen() {
  return (
    <Screen underHeader>
      <AccountSettings />
    </Screen>
  );
}
