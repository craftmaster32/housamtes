import { useState } from 'react';
import { StyleSheet } from 'react-native';
import { Image } from 'expo-image';

const ILLUSTRATIONS = [
  require('../../assets/images/auth-illustrations/living-room.jpg'),
  require('../../assets/images/auth-illustrations/sleeping-cat.jpg'),
  require('../../assets/images/auth-illustrations/home-office.jpg'),
  require('../../assets/images/auth-illustrations/window-chair.jpg'),
  require('../../assets/images/auth-illustrations/couch-chat.jpg'),
  require('../../assets/images/auth-illustrations/cooking.jpg'),
  require('../../assets/images/auth-illustrations/board-game.jpg'),
  require('../../assets/images/auth-illustrations/planning.jpg'),
  require('../../assets/images/auth-illustrations/watching-tv.jpg'),
  require('../../assets/images/auth-illustrations/high-five.jpg'),
  require('../../assets/images/auth-illustrations/golden-retriever.jpg'),
];

function pickRandom<T>(items: T[]): T {
  return items[Math.floor(Math.random() * items.length)];
}

/** A random household illustration, re-rolled on every mount, to fill empty space on auth screens. */
export function AuthIllustration(): React.JSX.Element {
  const [source] = useState(() => pickRandom(ILLUSTRATIONS));

  return (
    <Image
      source={source}
      style={styles.image}
      contentFit="contain"
      accessible={false}
      accessibilityElementsHidden
      accessibilityIgnoresInvertColors
      importantForAccessibility="no"
    />
  );
}

const styles = StyleSheet.create({
  image: {
    width: '100%',
    height: '100%',
  },
});
