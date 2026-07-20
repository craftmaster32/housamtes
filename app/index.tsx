import { View, StyleSheet, ActivityIndicator } from 'react-native';
import { useThemedColors } from '@constants/colors';

export default function Index(): React.JSX.Element {
  const c = useThemedColors();
  return (
    <View style={[styles.container, { backgroundColor: c.background }]}>
      <ActivityIndicator size="large" color={c.primary} />
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
