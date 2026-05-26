import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./src/**/*.{ts,tsx,js,jsx,mdx}'],
  theme: {
    extend: {
      fontFamily: {
        display: ['var(--font-display)', 'serif'],
        sans: ['var(--font-sans)', 'system-ui', 'sans-serif'],
        mono: ['var(--font-mono)', 'monospace'],
      },
      colors: {
        ink: {
          DEFAULT: '#0a0a0a',
          soft: '#1a1a1a',
        },
        paper: {
          DEFAULT: '#f5f1e8',
          soft: '#efe9d9',
          warm: '#e8dfc5',
        },
        signal: {
          rust: '#b8442e',
          ochre: '#c89b3c',
          moss: '#5a6b3a',
          ink: '#1e2a3a',
        },
        status: {
          reported: '#c89b3c',
          assigned: '#1e6091',
          progress: '#5a6b3a',
          resolved: '#2d5016',
          reroute: '#b8442e',
        },
      },
      animation: {
        'fade-up': 'fade-up 0.5s ease-out',
        'pulse-soft': 'pulse-soft 2s ease-in-out infinite',
      },
      keyframes: {
        'fade-up': {
          '0%': { opacity: '0', transform: 'translateY(10px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        'pulse-soft': {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.6' },
        },
      },
    },
  },
  plugins: [],
};
export default config;
