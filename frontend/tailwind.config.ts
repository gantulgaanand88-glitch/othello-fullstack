import type { Config } from 'tailwindcss';

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      boxShadow: {
        board: '0 24px 48px rgba(0, 0, 0, 0.4), 0 8px 16px rgba(0, 0, 0, 0.25)',
      },
      animation: {
        'piece-wave-flip': 'waveFlip 600ms cubic-bezier(0.4, 0, 0.2, 1) both',
        'piece-place': 'piecePlace 350ms cubic-bezier(0.34, 1.56, 0.64, 1) both',
        'pulse-soft': 'pulseSoft 1.2s ease-in-out infinite',
        'fade-in-up': 'fadeInUp 400ms ease-out forwards',
      },
      keyframes: {
        waveFlip: {
          '0%': { transform: 'rotateY(0deg) scale(1)' },
          '30%': { transform: 'rotateY(90deg) scale(0.92)' },
          '50%': { transform: 'rotateY(180deg) scale(0.95)' },
          '70%': { transform: 'rotateY(180deg) scale(1.08)' },
          '100%': { transform: 'rotateY(180deg) scale(1)' },
        },
        piecePlace: {
          '0%': { transform: 'scale(0)', opacity: '0' },
          '60%': { transform: 'scale(1.15)', opacity: '1' },
          '100%': { transform: 'scale(1)', opacity: '1' },
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
