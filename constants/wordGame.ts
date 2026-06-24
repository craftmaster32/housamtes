export interface WordChallenge {
  word: string;
  hint: string;
  category: 'house' | 'kitchen' | 'cleaning' | 'bills' | 'roomie';
}

export const WORD_CHALLENGES: WordChallenge[] = [
  // ── House ──────────────────────────────────────────────────────────────────
  { word: 'COUCH', hint: 'Best seat for Netflix debates', category: 'house' },
  { word: 'REMOTE', hint: 'Always lost between cushions', category: 'house' },
  { word: 'PILLOW', hint: 'Head resting buddy', category: 'house' },
  { word: 'BLANKET', hint: 'Cozy layer for movie nights', category: 'house' },
  { word: 'SHOWER', hint: 'Morning wake-up ritual', category: 'house' },
  { word: 'TOWEL', hint: 'Don\'t forget to hang me up', category: 'house' },
  { word: 'HALLWAY', hint: 'The path between rooms', category: 'house' },
  { word: 'BALCONY', hint: 'Fresh air spot', category: 'house' },
  { word: 'DOORBELL', hint: 'Ding dong, delivery!', category: 'house' },
  { word: 'CURTAIN', hint: 'Blocks the morning sun', category: 'house' },
  { word: 'MIRROR', hint: 'Shows your true self', category: 'house' },
  { word: 'CARPET', hint: 'Soft floor covering', category: 'house' },
  { word: 'WINDOW', hint: 'Lets in the light', category: 'house' },
  { word: 'SHELF', hint: 'Storage for books and clutter', category: 'house' },
  { word: 'CLOSET', hint: 'Where clothes hide', category: 'house' },
  { word: 'THERMOSTAT', hint: 'Temperature wars central', category: 'house' },
  { word: 'SOCKET', hint: 'Where you plug in your charger', category: 'house' },
  { word: 'KEYCHAIN', hint: 'Holds the keys to the kingdom', category: 'house' },
  { word: 'MAILBOX', hint: 'Packages and bills arrive here', category: 'house' },
  { word: 'DOORMAT', hint: 'Wipe your feet!', category: 'house' },

  // ── Kitchen ────────────────────────────────────────────────────────────────
  { word: 'FRIDGE', hint: 'Where leftovers go to be forgotten', category: 'kitchen' },
  { word: 'KETTLE', hint: 'Boils water for tea or coffee', category: 'kitchen' },
  { word: 'TOASTER', hint: 'Crunchy bread maker', category: 'kitchen' },
  { word: 'SPOON', hint: 'Cereal\'s best friend', category: 'kitchen' },
  { word: 'PLATE', hint: 'Flat dish for food', category: 'kitchen' },
  { word: 'OVEN', hint: 'Bakes your midnight pizza', category: 'kitchen' },
  { word: 'RECIPE', hint: 'Instructions for cooking', category: 'kitchen' },
  { word: 'BLENDER', hint: 'Makes smoothies and noise', category: 'kitchen' },
  { word: 'SPONGE', hint: 'Cleaning ally for dishes', category: 'kitchen' },
  { word: 'PANTRY', hint: 'Snack storage room', category: 'kitchen' },
  { word: 'MICROWAVE', hint: 'Reheats yesterday\'s dinner', category: 'kitchen' },
  { word: 'CUTTING', hint: '_____ board for chopping', category: 'kitchen' },
  { word: 'SPATULA', hint: 'Flips pancakes like a pro', category: 'kitchen' },
  { word: 'STRAINER', hint: 'Drains the pasta water', category: 'kitchen' },
  { word: 'APRON', hint: 'Protects your clothes while cooking', category: 'kitchen' },

  // ── Cleaning ───────────────────────────────────────────────────────────────
  { word: 'VACUUM', hint: 'Loud floor cleaner', category: 'cleaning' },
  { word: 'DUSTPAN', hint: 'Partners with the broom', category: 'cleaning' },
  { word: 'BLEACH', hint: 'Whitens and disinfects', category: 'cleaning' },
  { word: 'BUCKET', hint: 'Carries mop water', category: 'cleaning' },
  { word: 'TRASH', hint: 'Take me out!', category: 'cleaning' },
  { word: 'LAUNDRY', hint: 'Dirty clothes pile', category: 'cleaning' },
  { word: 'DETERGENT', hint: 'Makes clothes clean and fresh', category: 'cleaning' },
  { word: 'RECYCLE', hint: 'The eco-friendly bin', category: 'cleaning' },
  { word: 'SCRUB', hint: 'Vigorous cleaning action', category: 'cleaning' },
  { word: 'POLISH', hint: 'Makes surfaces shine', category: 'cleaning' },
  { word: 'DISINFECT', hint: 'Kills germs on surfaces', category: 'cleaning' },
  { word: 'SQUEEGEE', hint: 'Streak-free window tool', category: 'cleaning' },

  // ── Bills & Finance ────────────────────────────────────────────────────────
  { word: 'RECEIPT', hint: 'Proof you actually paid', category: 'bills' },
  { word: 'BUDGET', hint: 'Plan for your spending', category: 'bills' },
  { word: 'INVOICE', hint: 'Bill in fancy language', category: 'bills' },
  { word: 'EXPENSE', hint: 'Money going out', category: 'bills' },
  { word: 'DEPOSIT', hint: 'Money you hope to get back', category: 'bills' },
  { word: 'PAYMENT', hint: 'Settling what you owe', category: 'bills' },
  { word: 'UTILITIES', hint: 'Water, gas, electric', category: 'bills' },
  { word: 'SUBSCRIPTION', hint: 'Monthly charge you forgot about', category: 'bills' },
  { word: 'OVERDUE', hint: 'Past the deadline', category: 'bills' },
  { word: 'BALANCE', hint: 'What\'s left in the account', category: 'bills' },

  // ── Roomie Life ────────────────────────────────────────────────────────────
  { word: 'HOUSEMATE', hint: 'Person you share a home with', category: 'roomie' },
  { word: 'ROTATION', hint: 'Taking turns with chores', category: 'roomie' },
  { word: 'SCHEDULE', hint: 'Who does what and when', category: 'roomie' },
  { word: 'COMPROMISE', hint: 'Meeting in the middle', category: 'roomie' },
  { word: 'RESPECT', hint: 'Foundation of shared living', category: 'roomie' },
  { word: 'QUIET', hint: 'What you want after 11pm', category: 'roomie' },
  { word: 'PRIVACY', hint: 'Everyone needs some', category: 'roomie' },
  { word: 'VISITOR', hint: 'Guest at the house', category: 'roomie' },
  { word: 'AGREEMENT', hint: 'Rules everyone accepts', category: 'roomie' },
  { word: 'NEIGHBOR', hint: 'Person next door', category: 'roomie' },
  { word: 'CURFEW', hint: 'Time to keep it down', category: 'roomie' },
  { word: 'CHORE', hint: 'Nobody\'s favorite task', category: 'roomie' },
];

export function scrambleWord(word: string): string {
  const letters = word.split('');
  for (let i = letters.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [letters[i], letters[j]] = [letters[j], letters[i]];
  }
  const result = letters.join('');
  if (result === word && word.length > 1) return scrambleWord(word);
  return result;
}

export function getRandomChallenge(): WordChallenge {
  return WORD_CHALLENGES[Math.floor(Math.random() * WORD_CHALLENGES.length)];
}

export const CATEGORY_LABELS: Record<WordChallenge['category'], { emoji: string; label: string }> = {
  house: { emoji: '🏠', label: 'House' },
  kitchen: { emoji: '🍳', label: 'Kitchen' },
  cleaning: { emoji: '🧹', label: 'Cleaning' },
  bills: { emoji: '💰', label: 'Bills' },
  roomie: { emoji: '👥', label: 'Roomie Life' },
};
