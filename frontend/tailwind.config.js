/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/**/*.{js,jsx,ts,tsx}",
  ],
  theme: {
    extend: {
      darkMode: ['class', 'attribute', 'data-theme'],
      fontFamily: {
        sans: ['Inter', 'sans-serif'],
        heading: ['Space Grotesk', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
      },
      colors: {
        // Light mode colors
        background: 'var(--bg)',
        surface: 'var(--surface)',
        primary: 'var(--primary)',
        secondary: 'var(--secondary)',
        accent: 'var(--accent)',
        'text-primary': 'var(--text-primary)',
        'text-secondary': 'var(--text-secondary)',
        
        // Legacy color mappings for compatibility
        card: 'var(--surface)',
        border: 'var(--text-secondary)',
        
        // Semantic colors
        success: '#27AE60',
        error: '#E74C3C',
        warning: '#FFD700',
        info: '#00B8D9',
      },
      letterSpacing: {
        tight: '-0.025em',
        wide: '0.025em',
      },
      boxShadow: {
        'surface': '0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px 0 rgba(0, 0, 0, 0.06)',
        'surface-dark': '0 1px 3px 0 rgba(0, 0, 0, 0.3), 0 1px 2px 0 rgba(0, 0, 0, 0.2)',
      },
    },
  },
  plugins: [
    require('@tailwindcss/typography'),
  ],
};
 