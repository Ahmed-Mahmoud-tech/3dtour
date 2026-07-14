/** @type {import('tailwindcss').Config} */
// CJS on purpose: this config is loaded by BOTH Next.js (postcss) and the
// Vite static-player build. Keep it require()-compatible.
module.exports = {
  content: ['./app/**/*.{js,jsx}', './src/**/*.{js,jsx}', './index.html'],
  theme: {
    extend: {
      colors: {
        ink: {
          950: '#04070a',
          900: '#070d13',
          800: '#0c141d',
          700: '#131e2a',
        },
        brand: {
          DEFAULT: '#10c9b7',
          dim: '#0b9d8f',
          bright: '#3ef0dd',
          faint: 'rgba(16, 201, 183, 0.12)',
        },
      },
      fontFamily: {
        // --font-manrope / --font-arabic come from next/font in app/layout.jsx.
        // The Vite static-player build has no next/font — system fallbacks apply.
        sans: ['var(--font-manrope)', 'var(--font-arabic)', 'system-ui', 'sans-serif'],
        arabic: ['var(--font-arabic)', 'var(--font-manrope)', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
