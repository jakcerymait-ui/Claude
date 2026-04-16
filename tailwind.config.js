/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/**/*.{js,jsx,ts,tsx}'],
  theme: {
    extend: {
      colors: {
        dark: {
          900: '#0a0a0f',
          800: '#12121a',
          700: '#1a1a2e',
          600: '#16213e',
          500: '#0f3460',
        },
        accent: {
          400: '#e94560',
          500: '#c73652',
        },
        surface: {
          DEFAULT: '#1e1e2e',
          hover: '#2a2a3e',
          border: '#2e2e45',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
