/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  important: '#landing-v3-root',
  darkMode: 'class',
  corePlugins: {
    preflight: false,
  },
  theme: {
    extend: {
      fontFamily: {
        sans: ['"Bricolage Grotesque"', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        display: ['Newsreader', 'Georgia', 'serif'],
      },
      fontSize: {
        'display': ['clamp(2.25rem,5vw,3.25rem)', { lineHeight: '1.08', letterSpacing: '-0.03em', fontWeight: '600' }],
      },
      keyframes: {
        'v3-fade-up': {
          from: { opacity: '0', transform: 'translate3d(0,10px,0)' },
          to: { opacity: '1', transform: 'translate3d(0,0,0)' },
        },
        'v3-pulse-soft': {
          '0%, 100%': { opacity: '0.5' },
          '50%': { opacity: '0.85' },
        },
      },
      animation: {
        'v3-fade-up': 'v3-fade-up 0.55s cubic-bezier(0.2,0.8,0.2,1) both',
        'v3-pulse-soft': 'v3-pulse-soft 4s ease-in-out infinite',
      },
    },
  },
  plugins: [],
};
