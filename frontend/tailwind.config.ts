import type { Config } from 'tailwindcss';

export default {
  content: [
    './index.html',
    './src/**/*.{js,ts,jsx,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          50: '#eefbf7',
          100: '#d4f5e9',
          200: '#a9e8d4',
          300: '#74d3b7',
          400: '#39b892',
          500: '#149c77',
          600: '#0f7e61',
          700: '#10654f',
          800: '#104f3f',
          900: '#103f34',
          950: '#072720',
        },
        ink: {
          50: '#f6f8f7',
          100: '#e8ecea',
          200: '#cfd8d4',
          300: '#aebcb6',
          400: '#7e948b',
          500: '#5c726a',
          600: '#475952',
          700: '#37453f',
          800: '#24302c',
          900: '#18211e',
          950: '#0c1210',
        },
      },
      fontFamily: {
        sans: ['Manrope', 'system-ui', 'sans-serif'],
        mono: ['IBM Plex Mono', 'ui-monospace', 'SFMono-Regular', 'monospace'],
      },
      keyframes: {
        'fade-in': {
          '0%': { opacity: '0', transform: 'translateY(-4px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        'slide-in-left': {
          '0%': { opacity: '0', transform: 'translateX(-18px)' },
          '100%': { opacity: '1', transform: 'translateX(0)' },
        },
      },
      animation: {
        'fade-in': 'fade-in 0.24s ease-out',
        'slide-in-left': 'slide-in-left 0.22s ease-out',
      },
      boxShadow: {
        glow: '0 20px 50px rgba(16, 101, 79, 0.18)',
        panel: '0 18px 45px rgba(12, 18, 16, 0.08)',
      },
    },
  },
  plugins: [],
} satisfies Config;
