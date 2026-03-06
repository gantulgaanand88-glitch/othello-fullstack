import type { Config } from 'tailwindcss';

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      boxShadow: {
        board: '0 24px 48px rgba(0, 0, 0, 0.35)',
      },
      animation: {
        'piece-flip': 'pieceFlip 500ms ease-in-out',
        'pulse-soft': 'pulseSoft 1.2s ease-in-out infinite',
        'fade-in-up': 'fadeInUp 400ms ease-out forwards',
      },
      keyframes: {
        pieceFlip: {
          '0%': { transform: 'scaleX(1)' },
          '50%': { transform: 'scaleX(0)' },
          '100%': { transform: 'scaleX(1)' },
        },
        pulseSoft: {
          '0%, 100%': { transform: 'scale(1)', opacity: '1' },
          '50%': { transform: 'scale(1.15)', opacity: '0.75' },
        },
        fadeInUp: {
          '0%': { opacity: '0', transform: 'translateY(12px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
      },
    },
  },
  plugins: [],
} satisfies Config;
