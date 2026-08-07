import { View, StyleSheet } from 'react-native';
import { LoadingSpinner } from '@components/shared/LoadingSpinner';
import { useThemedColors } from '@constants/colors';

export default function Index(): React.JSX.Element {
  const c = useThemedColors();
  return (
    <View style={[styles.container, { backgroundColor: c.background }]}>
      <LoadingSpinner size={140} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
