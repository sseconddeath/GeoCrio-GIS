import type { Config } from 'tailwindcss';
import { COLORS } from './lib/constants';

const config: Config = {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        header: COLORS.header,
        borehole: COLORS.borehole,
        'observation-point': COLORS.observationPoint,
        water: COLORS.water,
        permafrost: {
          frozen: COLORS.permafrost.frozen,
          thawed: COLORS.permafrost.thawed,
          transitional: COLORS.permafrost.transitional,
        },
      },
      fontFamily: {
        sans: ['var(--font-inter)', 'system-ui', 'sans-serif'],
      },
      screens: {
        tablet: '768px',
        desktop: '1024px',
      },
    },
  },
  plugins: [],
};

export default config;
