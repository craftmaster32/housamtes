// react-native-web's Switch accepts `activeThumbColor`, but @types/react-native's
// SwitchProps doesn't declare it (it's a web-only addition, not in RN core).
import 'react-native';

declare module 'react-native' {
  interface SwitchProps {
    activeThumbColor?: string;
  }
}
