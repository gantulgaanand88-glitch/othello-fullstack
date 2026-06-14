import type { Config } from 'tailwindcss';

// Premium dark palette — custom HSL values, zero default Tailwind colors used in components
const colors = {
  // ── Backgrounds ──────────────────────────────────────────────────────
  'base':        '#0e0e0e', // deepest bg
  'surface':     '#161614', // cards / panels
  'elevated':    '#1f1e1b', // inputs / hover targets
  'border':      '#2a2926', // subtle borders
  'border-strong': '#3d3b37', // focused / active borders

  // ── Foregrounds ───────────────────────────────────────────────────────
  'ink':         '#f0ece4', // primary text — warm ivory
  'ink-muted':   '#7a7670', // secondary text
  'ink-faint':   '#3d3b37', // placeholders / disabled

  // ── Accent — muted gold ───────────────────────────────────────────────
  'gold':        '#c9a84c', // primary accent
  'gold-dim':    '#c9a84c26', // gold at 15% opacity
  'gold-glow':   '#c9a84c14', // gold at 8% — for glow halos

  // ── Semantic ──────────────────────────────────────────────────────────
  'danger':      '#c94c4c',
  'danger-dim':  '#c94c4c26',
  'success':     '#4caf82',
  'success-dim': '#4caf8226',
  'info':        '#4c7fc9',

  // ── Piece colors ──────────────────────────────────────────────────────
  'piece-dark-hi':  '#2e2e2e',
  'piece-dark-lo':  '#090909',
  'piece-light-hi': '#f5f0e8',
  'piece-light-lo': '#c8bfaf',

  // ── Board ─────────────────────────────────────────────────────────────
  'board-bg':    '#0d1a0d', // dark forest felt
  'board-line':  '#172417', // grid line — barely visible
  'board-alt':   '#0f1c0f', // alternating cell (subtle checkerboard)
  'board-legal': '#c9a84c20', // legal move highlight
};

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    // Replace default theme completely — nothing bleeds in
    colors: {
      transparent: 'transparent',
      current: 'currentColor',
      white: '#ffffff',
      black: '#000000',
      ...colors,
    },
    fontFamily: {
      sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
      mono: ['"DM Mono"', '"Fira Code"', 'monospace'],
      serif: ['"DM Serif Display"', 'Georgia', 'serif'],
    },
    fontSize: {
      '2xs': ['0.625rem', { lineHeight: '1rem' }],
      xs:   ['0.75rem',  { lineHeight: '1.125rem' }],
      sm:   ['0.875rem', { lineHeight: '1.375rem' }],
      base: ['1rem',     { lineHeight: '1.625rem' }],
      lg:   ['1.125rem', { lineHeight: '1.75rem' }],
      xl:   ['1.25rem',  { lineHeight: '1.875rem' }],
      '2xl':['1.5rem',   { lineHeight: '2rem' }],
      '3xl':['1.875rem', { lineHeight: '2.375rem' }],
      '4xl':['2.25rem',  { lineHeight: '2.75rem' }],
      '5xl':['3rem',     { lineHeight: '1.1' }],
      '6xl':['3.75rem',  { lineHeight: '1.05' }],
      '7xl':['4.5rem',   { lineHeight: '1' }],
    },
    borderRadius: {
      none: '0',
      sm:   '2px',
      DEFAULT: '4px',
      md:   '6px',
      lg:   '8px',
      xl:   '12px',
      '2xl':'16px',
      full: '9999px',
    },
    extend: {
      spacing: {
        '4.5': '1.125rem',
        '13':  '3.25rem',
        '15':  '3.75rem',
        '18':  '4.5rem',
        '22':  '5.5rem',
      },
      boxShadow: {
        'board': '0 32px 64px rgba(0,0,0,0.6), 0 4px 12px rgba(0,0,0,0.4)',
        'piece-dark': '0 3px 10px rgba(0,0,0,0.9), inset 0 1px 2px rgba(255,255,255,0.06)',
        'piece-light': '0 3px 10px rgba(0,0,0,0.6), inset 0 1px 3px rgba(255,255,255,0.55)',
        'gold':  '0 0 20px rgba(201,168,76,0.25)',
        'panel': '0 1px 0 rgba(240,236,228,0.04)',
      },
      animation: {
        // Piece animations
        'flip':        'flip 550ms cubic-bezier(0.4,0,0.2,1)',
        'place':       'place 250ms cubic-bezier(0.34,1.56,0.64,1)',
        'legal-pulse': 'legalPulse 2s ease-in-out infinite',

        // UI animations
        'fade-up':     'fadeUp 350ms ease-out forwards',
        'fade-in':     'fadeIn 200ms ease-out forwards',
        'slide-down':  'slideDown 280ms ease-out forwards',
        'slide-up':    'slideUp 280ms ease-out forwards',
        'shimmer':     'shimmer 1.5s infinite linear',
        'toast-in':    'toastIn 280ms ease-out forwards',
        'toast-out':   'toastOut 280ms ease-in forwards',
        'spin-slow':   'spin 1.2s linear infinite',

        // Player turn indicator
        'pulse-gold':  'pulseGold 1.4s ease-in-out infinite',
      },
      keyframes: {
        // ── Piece flip: Y-axis 3D rotation ───────────────────────────────
        flip: {
          '0%':   { transform: 'rotateY(0deg) scale(1)' },
          '30%':  { transform: 'rotateY(90deg) scale(1.06)' },
          '50%':  { transform: 'rotateY(90deg) scale(1.08)' },
          '70%':  { transform: 'rotateY(180deg) scale(1.06)' },
          '100%': { transform: 'rotateY(180deg) scale(1)' },
        },
        // ── Piece place: pop-in ───────────────────────────────────────────
        place: {
          '0%':   { transform: 'scale(0)', opacity: '0' },
          '60%':  { transform: 'scale(1.12)' },
          '100%': { transform: 'scale(1)', opacity: '1' },
        },
        // ── Legal move dot pulse ──────────────────────────────────────────
        legalPulse: {
          '0%, 100%': { opacity: '0.3', transform: 'scale(0.9)' },
          '50%':      { opacity: '0.6', transform: 'scale(1.1)' },
        },
        // ── UI transitions ────────────────────────────────────────────────
        fadeUp: {
          '0%':   { opacity: '0', transform: 'translateY(10px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        fadeIn: {
          '0%':   { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideDown: {
          '0%':   { opacity: '0', maxHeight: '0', transform: 'translateY(-6px)' },
          '100%': { opacity: '1', maxHeight: '500px', transform: 'translateY(0)' },
        },
        slideUp: {
          '0%':   { opacity: '0', transform: 'translateY(16px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        shimmer: {
          '0%':   { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
        toastIn: {
          '0%':   { opacity: '0', transform: 'translateY(6px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        toastOut: {
          '0%':   { opacity: '1' },
          '100%': { opacity: '0' },
        },
        pulseGold: {
          '0%, 100%': { boxShadow: '0 0 0 0 rgba(201,168,76,0)' },
          '50%':      { boxShadow: '0 0 0 4px rgba(201,168,76,0.18)' },
        },
      },
    },
  },
  plugins: [],
} satisfies Config;
