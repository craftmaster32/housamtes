import { Redirect } from 'expo-router';

// Chores were merged into Tasks (Oct 2026). This address is kept so old links
// and chore notifications (web push opens /chores) still land on the list.
export default function ChoresRedirect(): React.JSX.Element {
  return <Redirect href="/(tabs)/tasks" />;
}
