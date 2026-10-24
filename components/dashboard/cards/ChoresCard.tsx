import { View } from 'react-native';
import { Text } from 'react-native-paper';
import { useTranslation } from 'react-i18next';
import { navigateToBase } from '@stores/navigationStore';
import { useTasksStore } from '@stores/tasksStore';
import { useLanguageStore } from '@stores/languageStore';
import { isRTL } from '@lib/i18n';
import { useHeadingFont } from '@hooks/useHeadingFont';
import { type CardStyles } from '@components/dashboard/cards/cardStyles';
import { CardShell } from '@components/dashboard/cards/CardShell';
import { CardLabel } from '@components/dashboard/cards/CardLabel';
import { BucketArt } from '@components/dashboard/art/BucketArt';
import { ms } from '@utils/responsive';

interface ChoresCardProps {
  styles: CardStyles;
  pinned?: boolean;
}

export function ChoresCard({ styles, pinned = false }: ChoresCardProps): React.JSX.Element {
  const { t } = useTranslation();
  const headingFont = useHeadingFont('semibold');
  const rtl = isRTL(useLanguageStore((s) => s.language));
  const tasks = useTasksStore((s) => s.tasks);
  const total = tasks.length;
  const done = tasks.filter((tk) => tk.isComplete).length;
  const next = tasks.find((tk) => !tk.isComplete);
  return (
    <CardShell
      styles={styles}
      pinned={pinned}
      onPress={() => navigateToBase('/(tabs)/tasks')}
      accessibilityLabel={t('dashboard.x_of_y_done', { done, total })}
    >
      <CardLabel
        styles={styles}
        icon="checkmark-done-outline"
        label={t('dashboard.tasks_label')}
        pinned={pinned}
      />
      <Text style={[styles.big, headingFont]}>
        {done}
        <Text style={styles.bigDenom}>/{total}</Text>
      </Text>
      <Text style={styles.sub} numberOfLines={1}>
        {next ? t('dashboard.chore_next', { name: next.title }) : t('dashboard.chores_smashed')}
      </Text>
      <View style={rtl ? styles.artRTL : styles.art} pointerEvents="none">
        <BucketArt width={ms(40)} />
      </View>
    </CardShell>
  );
}
