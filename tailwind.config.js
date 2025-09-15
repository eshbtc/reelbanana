/** @type {import('tailwindcss').Config} */
export default {
  content: [
    './index.html',
    './src/**/*.{js,jsx,ts,tsx}',
    './components/**/*.{js,jsx,ts,tsx}',
    './services/**/*.{js,jsx,ts,tsx}',
    './lib/**/*.{js,jsx,ts,tsx}',
    './hooks/**/*.{js,jsx,ts,tsx}',
    './utils/**/*.{js,jsx,ts,tsx}',
    './App.tsx',
    './index.tsx',
    './RenderingScreen.tsx',
    './MoviePlayer.tsx',
    './StoryboardEditor.tsx',
    './types.ts',
  ],
  theme: {
    extend: {},
  },
  plugins: [],
};
