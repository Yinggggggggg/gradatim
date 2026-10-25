import { AiSettingsSection } from '@/components/ai-settings';
import { Screen } from '@/components/ui';

export default function AiScreen() {
  return (
    <Screen underHeader>
      <AiSettingsSection />
    </Screen>
  );
}
