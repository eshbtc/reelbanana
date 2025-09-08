import { Scene } from '../types';

export interface StoryTemplate {
  id: string;
  title: string;
  topic: string;
  characterAndStyle: string;
  scenes: Array<Pick<Scene, 'prompt' | 'narration'>>;
  characterRefs?: string[]; // optional built-in passport refs
}

export const TEMPLATES: StoryTemplate[] = [
  // Realistic Human Stories
  {
    id: 'urban-explorer',
    title: 'The Urban Explorer',
    topic: 'A photographer discovers hidden beauty in the city',
    characterAndStyle:
      'A young photographer with a vintage camera; realistic urban photography style, natural lighting, documentary feel.',
    scenes: [
      {
        prompt: 'A photographer in their 20s walks through a bustling city street at golden hour, camera in hand, looking for the perfect shot.',
        narration: 'In every corner of the city, there\'s a story waiting to be told.',
      },
      {
        prompt: 'Close-up of the photographer\'s hands adjusting camera settings, focused expression, city lights reflecting in their eyes.',
        narration: 'The right moment, captured at the right time, can change everything.',
      },
      {
        prompt: 'The photographer crouches in an alley, photographing a small flower growing through concrete, finding beauty in unexpected places.',
        narration: 'Sometimes the most beautiful things grow in the most unlikely places.',
      },
      {
        prompt: 'Wide shot of the photographer\'s exhibition, people admiring photos of hidden city beauty, pride and accomplishment visible.',
        narration: 'Art has the power to show us the world through new eyes.',
      },
    ],
    characterRefs: [],
  },
  {
    id: 'coffee-shop-romance',
    title: 'Coffee Shop Romance',
    topic: 'Two strangers meet in a cozy coffee shop',
    characterAndStyle:
      'Two people in their 30s in a warm, cozy coffee shop; romantic lighting, soft focus, warm color palette.',
    scenes: [
      {
        prompt: 'A busy coffee shop during morning rush, two people accidentally bump into each other, coffee cups in hand, apologetic smiles.',
        narration: 'Sometimes the best stories begin with a simple "excuse me."',
      },
      {
        prompt: 'Close-up of hands reaching for the same newspaper on a table, fingers almost touching, nervous glances exchanged.',
        narration: 'In that moment, time seemed to stand still.',
      },
      {
        prompt: 'The two sit at a corner table, deep in conversation, steam rising from their cups, the world around them fading away.',
        narration: 'Some conversations feel like they could last forever.',
      },
      {
        prompt: 'Wide shot of the coffee shop at closing time, the two people still talking, the barista smiling as they lock up.',
        narration: 'And sometimes, forever starts with a single cup of coffee.',
      },
    ],
    characterRefs: [],
  },

  // Documentary Style
  {
    id: 'street-artist',
    title: 'The Street Artist',
    topic: 'A muralist transforms a neighborhood wall',
    characterAndStyle:
      'A street artist in their 40s with paint-stained clothes; documentary style, natural lighting, urban setting.',
    scenes: [
      {
        prompt: 'A street artist surveys a blank brick wall in a residential neighborhood, sketchbook in hand, planning their next masterpiece.',
        narration: 'Every wall is a canvas waiting for its story.',
      },
      {
        prompt: 'The artist begins painting, vibrant colors emerging on the wall, neighbors watching curiously from their windows.',
        narration: 'Art has the power to bring communities together.',
      },
      {
        prompt: 'Children gather around the artist, asking questions and watching the mural come to life, wonder in their eyes.',
        narration: 'Sometimes the greatest impact is on the youngest hearts.',
      },
      {
        prompt: 'The completed mural shows a beautiful tree with roots connecting all the houses, neighbors admiring the finished work.',
        narration: 'In the end, the wall became a symbol of unity and hope.',
      },
    ],
    characterRefs: [],
  },

  // Thriller/Mystery
  {
    id: 'midnight-delivery',
    title: 'Midnight Delivery',
    topic: 'A delivery driver discovers something mysterious',
    characterAndStyle:
      'A delivery driver in their 30s; noir thriller style, dramatic shadows, urban night setting, suspenseful atmosphere.',
    scenes: [
      {
        prompt: 'A delivery driver pulls up to a dark warehouse at midnight, headlights cutting through the fog, something feels off.',
        narration: 'Some deliveries are more than they appear to be.',
      },
      {
        prompt: 'The driver approaches the warehouse door, package in hand, shadows moving in the windows, heart racing.',
        narration: 'In the silence of night, every sound becomes a warning.',
      },
      {
        prompt: 'Inside the warehouse, the driver discovers the package contains something unexpected, flashlight beam revealing the truth.',
        narration: 'Sometimes the greatest discoveries come from the most ordinary moments.',
      },
      {
        prompt: 'The driver emerges from the warehouse, changed by what they\'ve seen, driving away into the night with a new purpose.',
        narration: 'And sometimes, one delivery can change everything.',
      },
    ],
    characterRefs: [],
  },

  // Sci-Fi
  {
    id: 'time-traveler',
    title: 'The Time Traveler',
    topic: 'A scientist accidentally travels through time',
    characterAndStyle:
      'A scientist in their 40s with a futuristic device; sci-fi style, blue lighting, technological atmosphere, time distortion effects.',
    scenes: [
      {
        prompt: 'A scientist in a high-tech laboratory adjusts a complex time machine, blue energy crackling around the device.',
        narration: 'The line between discovery and disaster is thinner than we think.',
      },
      {
        prompt: 'The scientist activates the machine, reality bending around them, time itself seeming to fold and twist.',
        narration: 'In that moment, everything changed forever.',
      },
      {
        prompt: 'The scientist finds themselves in a different era, surrounded by people from another time, confusion and wonder on their face.',
        narration: 'Sometimes the greatest adventure is finding your way home.',
      },
      {
        prompt: 'The scientist returns to their own time, but everything looks different, understanding that time travel changes more than just location.',
        narration: 'And sometimes, the journey changes the traveler more than the destination.',
      },
    ],
    characterRefs: [],
  },

  // Fantasy
  {
    id: 'forest-guardian',
    title: 'The Forest Guardian',
    topic: 'A hiker discovers a magical forest',
    characterAndStyle:
      'A hiker in their 30s in an enchanted forest; fantasy style, mystical lighting, magical atmosphere, ethereal beauty.',
    scenes: [
      {
        prompt: 'A hiker walks through an ancient forest, sunlight filtering through leaves, something magical in the air.',
        narration: 'Some places hold secrets that only the brave can discover.',
      },
      {
        prompt: 'The hiker encounters a mystical creature, half-hidden in the shadows, eyes glowing with ancient wisdom.',
        narration: 'In the heart of the forest, magic still lives.',
      },
      {
        prompt: 'The hiker and the creature communicate without words, understanding passing between them, the forest itself listening.',
        narration: 'Sometimes the greatest conversations happen in silence.',
      },
      {
        prompt: 'The hiker emerges from the forest, changed by the encounter, carrying with them the wisdom of the ancient woods.',
        narration: 'And sometimes, the greatest gifts are the ones we can\'t see.',
      },
    ],
    characterRefs: [],
  },

  // Comedy
  {
    id: 'office-misadventure',
    title: 'Office Misadventure',
    topic: 'A day in the life of a quirky office worker',
    characterAndStyle:
      'An office worker in their 30s; comedic style, bright lighting, exaggerated expressions, workplace humor.',
    scenes: [
      {
        prompt: 'An office worker arrives at work, coffee in hand, already looking exhausted, the day ahead seeming impossible.',
        narration: 'Some days, the office feels like a comedy of errors waiting to happen.',
      },
      {
        prompt: 'The worker tries to use the photocopier, which immediately jams, papers flying everywhere, colleagues watching in amusement.',
        narration: 'In the battle between human and machine, the machine usually wins.',
      },
      {
        prompt: 'The worker attempts to give a presentation, but the slides are all wrong, showing cat memes instead of charts, everyone laughing.',
        narration: 'Sometimes the best presentations are the ones that don\'t go as planned.',
      },
      {
        prompt: 'The worker leaves the office at the end of the day, somehow having survived another day, walking into the sunset with a smile.',
        narration: 'And somehow, despite everything, we always find a way to make it through.',
      },
    ],
    characterRefs: [],
  },

  // Historical Drama
  {
    id: 'vintage-photographer',
    title: 'The Vintage Photographer',
    topic: 'A photographer captures life in the 1950s',
    characterAndStyle:
      'A photographer in their 40s in 1950s attire; vintage style, sepia tones, nostalgic atmosphere, period-accurate details.',
    scenes: [
      {
        prompt: 'A photographer in a 1950s suit sets up their camera on a busy street corner, people in period clothing walking by.',
        narration: 'Every photograph is a window into another time.',
      },
      {
        prompt: 'The photographer captures a young couple dancing, the woman in a poodle skirt, the man in a leather jacket, pure joy on their faces.',
        narration: 'In that moment, love was timeless.',
      },
      {
        prompt: 'The photographer develops the photos in a darkroom, red light casting shadows, each image a story waiting to be told.',
        narration: 'Some stories are written in light and shadow.',
      },
      {
        prompt: 'Years later, the photographer looks at the same photos, now yellowed with age, memories flooding back.',
        narration: 'And sometimes, the greatest stories are the ones we leave behind.',
      },
    ],
    characterRefs: [],
  },

  // Keep some of the original creative ones
  {
    id: 'superhero-banana',
    title: 'Superhero Banana',
    topic: 'A banana who becomes a neighborhood superhero',
    characterAndStyle:
      'A cute banana with a tiny red cape and big curious eyes; vibrant watercolor style, warm palette, soft edges, gentle light.',
    scenes: [
      {
        prompt: 'Sunrise in a small city street; our caped banana peeks from a fruit stand, eyes sparkling with purpose.',
        narration: 'Every hero has an origin. For our banana, it began at sunrise.',
      },
      {
        prompt: 'Close-up of the banana tying a tiny cape, determined expression, morning light streaks through the window.',
        narration: "With a brave heart and a bright cape, Banana was ready.",
      },
      {
        prompt: 'Banana dashes to help a child with a dropped ice cream, cape fluttering; kind smiles around.',
        narration: 'A small act of kindness can be a superpower.',
      },
      {
        prompt: 'Wide shot: the neighborhood cheers as Banana poses heroically, cape billowing in the breeze.',
        narration: 'A hero is anyone who cares — even a banana.',
      },
    ],
    characterRefs: [],
  },
  {
    id: 'noir-banana',
    title: 'The Great Banana Heist',
    topic: 'A noir caper with a clever banana detective',
    characterAndStyle:
      'Banana detective with a tiny fedora and trench coat; high-contrast film noir style, dramatic shadows, foggy streets.',
    scenes: [
      {
        prompt: 'Rain-slicked alley, neon reflections; banana detective adjusts fedora, silhouette against a streetlamp.',
        narration: 'In this city, even the shadows keep secrets.',
      },
      {
        prompt: 'Close-up: banana studies a mysterious peel-shaped clue by flickering light.',
        narration: 'Clues whisper to those who look closely.',
      },
      {
        prompt: 'Banana ducks behind crates as sneaky fruit thieves tiptoe by, lightning flashes.',
        narration: 'Heroes move quietly when the night grows loud.',
      },
      {
        prompt: 'Triumphant reveal: the heist foiled; banana tips the hat, dawn breaking through the fog.',
        narration: 'Justice, like sunrise, always finds a way.',
      },
    ],
    characterRefs: [],
  },
];
