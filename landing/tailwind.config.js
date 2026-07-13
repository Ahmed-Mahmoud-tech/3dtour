/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./app/**/*.{js,jsx}', './components/**/*.{js,jsx}'],
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
        sans: ['var(--font-manrope)', 'var(--font-arabic)', 'system-ui', 'sans-serif'],
        arabic: ['var(--font-arabic)', 'var(--font-manrope)', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
