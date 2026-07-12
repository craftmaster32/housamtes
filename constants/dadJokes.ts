export interface DadJoke {
  setup: string;
  punchline: string;
  category: 'bills' | 'parking' | 'chores' | 'grocery' | 'house' | 'general';
}

const DAD_JOKES: DadJoke[] = [
  // ── Bills & Money ──────────────────────────────────────────────────────────
  {
    setup: 'Why did the bill go to therapy?',
    punchline: 'It had too many issues to settle.',
    category: 'bills',
  },
  {
    setup: 'What did the electricity bill say to the housemate?',
    punchline: 'You light up my life… and my charges.',
    category: 'bills',
  },
  {
    setup: 'Why do bills never get invited to parties?',
    punchline: 'Because they always bring the total down.',
    category: 'bills',
  },
  {
    setup: 'What did one bill say to the other?',
    punchline: "I'm outstanding… and so are you.",
    category: 'bills',
  },
  {
    setup: 'Why was the math book sad about the rent?',
    punchline: 'It had too many problems.',
    category: 'bills',
  },
  {
    setup: 'Why did the housemate bring a ladder to pay rent?',
    punchline: 'Because the cost was through the roof.',
    category: 'bills',
  },
  {
    setup: "What's a bill's favorite type of music?",
    punchline: 'Heavy metal — because it weighs on you.',
    category: 'bills',
  },
  {
    setup: 'Why did the Wi-Fi bill break up with the electricity bill?',
    punchline: 'There was no connection anymore.',
    category: 'bills',
  },
  {
    setup: 'How do bills exercise?',
    punchline: 'They do crunches — number crunches.',
    category: 'bills',
  },
  {
    setup: 'Why are utility bills so dramatic?',
    punchline: "They're always making a scene about being overdue.",
    category: 'bills',
  },
  {
    setup: "What's a housemate's least favorite game?",
    punchline: 'Bill-iards.',
    category: 'bills',
  },
  {
    setup: 'Why did the water bill feel bubbly?',
    punchline: 'It was full of liquid assets.',
    category: 'bills',
  },
  {
    setup: 'What did the housemate say when the bill arrived?',
    punchline: "Well, that's not very settle-ing.",
    category: 'bills',
  },
  {
    setup: 'Why was the internet bill so slow to arrive?',
    punchline: 'It had a bad connection.',
    category: 'bills',
  },
  {
    setup: 'What do you call a housemate who always pays on time?',
    punchline: 'A myth.',
    category: 'bills',
  },

  // ── Parking ────────────────────────────────────────────────────────────────
  {
    setup: 'Why did the car apply for a parking reservation?',
    punchline: 'It wanted a spot in life.',
    category: 'parking',
  },
  {
    setup: 'What did the parking spot say to the car?',
    punchline: "I've been saving this space just for you.",
    category: 'parking',
  },
  {
    setup: 'Why do housemates fight over parking?',
    punchline: "Because it's a spot-on issue.",
    category: 'parking',
  },
  {
    setup: "What's a parking spot's favorite dance move?",
    punchline: 'The parallel slide.',
    category: 'parking',
  },
  {
    setup: 'Why did the housemate vote against the parking request?',
    punchline: "They couldn't find a reason to let it slide.",
    category: 'parking',
  },
  {
    setup: 'What do you call a parking spot that tells jokes?',
    punchline: 'A comedy lot.',
    category: 'parking',
  },
  {
    setup: 'Why was the parking spot always calm?',
    punchline: 'It knew how to stay in its space.',
    category: 'parking',
  },
  {
    setup: 'What did the car say when it got the spot?',
    punchline: 'This is wheely great!',
    category: 'parking',
  },
  {
    setup: 'Why did the housemate take a photo of the parking spot?',
    punchline: 'They wanted a spot-light moment.',
    category: 'parking',
  },
  {
    setup: 'How did the parking spot feel about the reservation?',
    punchline: 'It was floored.',
    category: 'parking',
  },
  {
    setup: 'Why do parking spots never argue?',
    punchline: 'They know when to back off.',
    category: 'parking',
  },
  {
    setup: "What's a car's favorite app feature?",
    punchline: "The parking spot — it's always free real estate.",
    category: 'parking',
  },

  // ── Chores ─────────────────────────────────────────────────────────────────
  {
    setup: 'Why did the broom break up with the mop?',
    punchline: 'It felt swept aside.',
    category: 'chores',
  },
  {
    setup: 'What did the dishes say to the housemate?',
    punchline: "You're really letting things pile up.",
    category: 'chores',
  },
  {
    setup: 'Why did the vacuum cleaner go to therapy?',
    punchline: "It was tired of everyone's dirt.",
    category: 'chores',
  },
  {
    setup: 'What do you call someone who does all the chores?',
    punchline: 'A legend. Also exhausted.',
    category: 'chores',
  },
  {
    setup: 'Why did the trash take itself out?',
    punchline: 'It was tired of waiting for the housemates.',
    category: 'chores',
  },
  {
    setup: "What's a chore's favorite day of the week?",
    punchline: 'Duesday.',
    category: 'chores',
  },
  {
    setup: 'Why did the mop feel underappreciated?',
    punchline: 'Everyone walked all over it.',
    category: 'chores',
  },
  {
    setup: 'What did the laundry say when it was done?',
    punchline: 'That was a load off my mind.',
    category: 'chores',
  },
  {
    setup: 'Why do sponges make great housemates?',
    punchline: 'They soak up all the work.',
    category: 'chores',
  },
  {
    setup: 'What did the toilet say to the cleaning brush?',
    punchline: 'You really get to the bottom of things.',
    category: 'chores',
  },
  {
    setup: 'Why was the chore chart crying?',
    punchline: 'Nobody checked it off.',
    category: 'chores',
  },
  {
    setup: 'How do you make a chore exciting?',
    punchline: "Call it a 'challenge' and add a timer.",
    category: 'chores',
  },
  {
    setup: 'Why did the broom get promoted?',
    punchline: 'It swept the competition.',
    category: 'chores',
  },
  {
    setup: "What's the laziest chore?",
    punchline: "The one that's been 'soaking' for three days.",
    category: 'chores',
  },

  // ── Grocery ────────────────────────────────────────────────────────────────
  {
    setup: 'Why did the tomato turn red at the grocery store?',
    punchline: 'It saw the salad dressing.',
    category: 'grocery',
  },
  {
    setup: 'What did the bread say to the grocery list?',
    punchline: "I'm on a roll!",
    category: 'grocery',
  },
  {
    setup: 'Why did the housemate bring a calculator to the supermarket?',
    punchline: 'They wanted to count on the groceries.',
    category: 'grocery',
  },
  {
    setup: 'What do you call a shared grocery list that keeps growing?',
    punchline: 'A never-ending scroll of dreams.',
    category: 'grocery',
  },
  {
    setup: "Why can't eggs keep a secret?",
    punchline: 'They always crack under pressure.',
    category: 'grocery',
  },
  {
    setup: 'What did the milk say when it expired?',
    punchline: 'My time here has soured.',
    category: 'grocery',
  },
  {
    setup: 'Why was the grocery list so long?',
    punchline: 'Three housemates, three appetites, zero coordination.',
    category: 'grocery',
  },
  {
    setup: 'What did the banana say to the shopping cart?',
    punchline: 'I find you very a-peeling.',
    category: 'grocery',
  },
  {
    setup: 'Why did the housemate buy 10 packs of pasta?',
    punchline: 'It was on the list. They checked. Twice.',
    category: 'grocery',
  },
  {
    setup: "What do you call buying someone else's items by mistake?",
    punchline: 'Grocery roulette.',
    category: 'grocery',
  },
  {
    setup: 'Why did the onion cry at the store?',
    punchline: 'It was moved by the prices.',
    category: 'grocery',
  },
  { setup: "What's a fridge's favorite music?", punchline: 'Cool jazz.', category: 'grocery' },

  // ── House Life ─────────────────────────────────────────────────────────────
  {
    setup: 'Why did the housemate sleep on the couch?',
    punchline: 'The bed filed a complaint about overuse.',
    category: 'house',
  },
  {
    setup: "What's the WiFi password?",
    punchline: 'The most asked question in any house.',
    category: 'house',
  },
  {
    setup: 'Why did the door feel unloved?',
    punchline: 'Everyone kept slamming it.',
    category: 'house',
  },
  {
    setup: 'What did one wall say to the other?',
    punchline: "I'll meet you at the corner.",
    category: 'house',
  },
  {
    setup: 'Why did the house have great self-esteem?',
    punchline: 'It had a lot of support — structural and emotional.',
    category: 'house',
  },
  {
    setup: "What's a couch potato's favorite housemate?",
    punchline: 'The one who brings snacks.',
    category: 'house',
  },
  {
    setup: 'Why did the housemate bring a map home?',
    punchline: 'They kept losing the remote.',
    category: 'house',
  },
  {
    setup: 'What do you call a housemate who hogs the shower?',
    punchline: 'A drainiac.',
    category: 'house',
  },
  {
    setup: 'Why did the fridge break up with the stove?',
    punchline: 'Things got too heated.',
    category: 'house',
  },
  {
    setup: "What's the house's favorite time of year?",
    punchline: 'Rent-free fantasies season.',
    category: 'house',
  },
  {
    setup: 'Why did the housemate talk to the wall?',
    punchline: "The other housemates weren't listening either.",
    category: 'house',
  },
  {
    setup: 'What do you call three housemates agreeing on dinner?',
    punchline: 'A miracle.',
    category: 'house',
  },
  {
    setup: 'Why did the shower curtain look sad?',
    punchline: 'It saw too much.',
    category: 'house',
  },
  {
    setup: 'Why do housemates make great comedians?',
    punchline: 'They always have material from shared living.',
    category: 'house',
  },
  {
    setup: "What's the unwritten rule of housemates?",
    punchline: "If you finish it, you didn't see it.",
    category: 'house',
  },
  {
    setup: 'Why did the key feel important?',
    punchline: 'Without it, nobody gets in.',
    category: 'house',
  },
  {
    setup: 'What did the sink say to the housemate?',
    punchline: "You're really letting things go down the drain.",
    category: 'house',
  },
  {
    setup: 'Why is shared living like a sitcom?',
    punchline: 'Same cast, daily drama, no budget.',
    category: 'house',
  },

  // ── General / Life ─────────────────────────────────────────────────────────
  {
    setup: 'Why did the calendar break up with the clock?',
    punchline: 'Their days were numbered.',
    category: 'general',
  },
  { setup: 'What do you call a fake noodle?', punchline: 'An impasta.', category: 'general' },
  {
    setup: "I'm reading a book about anti-gravity.",
    punchline: "It's impossible to put down.",
    category: 'general',
  },
  {
    setup: 'Why do cows have hooves instead of feet?',
    punchline: 'Because they lactose.',
    category: 'general',
  },
  {
    setup: 'What did the ocean say to the beach?',
    punchline: 'Nothing, it just waved.',
    category: 'general',
  },
  {
    setup: "Why don't scientists trust atoms?",
    punchline: 'Because they make up everything.',
    category: 'general',
  },
  {
    setup: 'I told my wife she was drawing her eyebrows too high.',
    punchline: 'She seemed surprised.',
    category: 'general',
  },
  {
    setup: 'What do you call a bear with no teeth?',
    punchline: 'A gummy bear.',
    category: 'general',
  },
  {
    setup: 'I used to hate facial hair.',
    punchline: 'But then it grew on me.',
    category: 'general',
  },
  {
    setup: 'What do you call a sleeping dinosaur?',
    punchline: 'A dino-snore.',
    category: 'general',
  },
  {
    setup: 'Why did the scarecrow win an award?',
    punchline: 'He was outstanding in his field.',
    category: 'general',
  },
  {
    setup: "I'm afraid for the calendar.",
    punchline: 'Its days are numbered.',
    category: 'general',
  },
  {
    setup: 'Why did the bicycle fall over?',
    punchline: 'Because it was two-tired.',
    category: 'general',
  },
  {
    setup: "What do you call cheese that isn't yours?",
    punchline: 'Nacho cheese.',
    category: 'general',
  },
  {
    setup: 'I only know 25 letters of the alphabet.',
    punchline: "I don't know Y.",
    category: 'general',
  },
  { setup: 'What do you call a lazy kangaroo?', punchline: 'A pouch potato.', category: 'general' },
  {
    setup: "Why can't you hear a pterodactyl going to the bathroom?",
    punchline: 'Because the P is silent.',
    category: 'general',
  },
  { setup: 'How do you organize a space party?', punchline: 'You planet.', category: 'general' },
  { setup: 'What did the fish say when it hit the wall?', punchline: 'Dam.', category: 'general' },
  {
    setup: 'Why did the golfer bring two pairs of pants?',
    punchline: 'In case he got a hole in one.',
    category: 'general',
  },
];

export function getDailyJoke(): DadJoke {
  const today = new Date();
  const dayOfYear = Math.floor(
    (today.getTime() - new Date(today.getFullYear(), 0, 0).getTime()) / 86400000
  );
  return DAD_JOKES[dayOfYear % DAD_JOKES.length];
}

export function getRandomJoke(): DadJoke {
  return DAD_JOKES[Math.floor(Math.random() * DAD_JOKES.length)];
}
