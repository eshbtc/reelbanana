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
    id: 'space-banana',
    title: 'Space Banana Odyssey',
    topic: 'A banana astronaut explores a friendly cosmos',
    characterAndStyle:
      'Banana astronaut in a charming retro-futuristic suit; soft pastel sci-fi style, starry gradients, cozy glow.',
    scenes: [
      {
        prompt: 'Banana floats outside a tiny spaceship among twinkling stars, Earth distant, helmet gleaming.',
        narration: 'Out here, the stars whisper stories to those who listen.',
      },
      {
        prompt: 'Close-up of banana waving to a curious cosmic jellyfish drifting by, iridescent and kind.',
        narration: 'Friendship can be found in the most surprising places.',
      },
      {
        prompt: 'Banana lands on a moon with bouncy low gravity, leaving cheerful footprints.',
        narration: 'Every step leaves a mark, even on the smallest moons.',
      },
      {
        prompt: 'Wide shot: nebula backdrop, banana gazes in wonder, colors reflecting on the visor.',
        narration: 'The universe is big — and so is our curiosity.',
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
