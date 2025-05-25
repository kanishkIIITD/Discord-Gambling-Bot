/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/**/*.{js,jsx,ts,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'Roboto', 'Nunito Sans', 'sans-serif'],
      },
      colors: {
        background: '#18191C',
        card: '#23272A',
        primary: '#5865F2',
        secondary: '#FFA940',
        success: '#27AE60',
        error: '#E74C3C',
        warning: '#FFD700',
        info: '#00B8D9',
        'text-primary': '#FFFFFF',
        'text-secondary': '#C7C9D1',
        border: '#3A3F44',
      },
      letterSpacing: {
        tight: '-0.025em',
        wide: '0.025em',
      },
    },
  },
  plugins: [
    require('@tailwindcss/typography'),
  ],
};
 