import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        ink: '#0a0a0b',
        panel: '#141417',
        edge: '#26262b',
        muted: '#8b8b94',
        accent: '#6366f1',
      },
    },
  },
  plugins: [],
};

export default config;
