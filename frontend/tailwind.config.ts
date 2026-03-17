import type { Config } from 'tailwindcss';

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
      },
      boxShadow: {
        board: '0 24px 48px rgba(0, 0, 0, 0.35)',
      },
      animation: {
        'piece-flip': 'pieceFlip 500ms ease-in-out',
        'pulse-soft': 'pulseSoft 1.2s ease-in-out infinite',
        'fade-in-up': 'fadeInUp 400ms ease-out forwards',
        'slide-down': 'slideDown 300ms ease-out forwards',
        'toast': 'toastIn 300ms ease-out forwards, toastOut 300ms ease-in 1.7s forwards',
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
        slideDown: {
          '0%': { opacity: '0', maxHeight: '0', transform: 'translateY(-8px)' },
          '100%': { opacity: '1', maxHeight: '300px', transform: 'translateY(0)' },
        },
        toastIn: {
          '0%': { opacity: '0', transform: 'translateY(8px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        toastOut: {
          '0%': { opacity: '1' },
          '100%': { opacity: '0' },
        },
      },
    },
  },
  plugins: [],
} satisfies Config;
