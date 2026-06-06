/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // accent is driven by CSS variable so user can pick at runtime
        accent: {
          50: 'rgb(var(--accent-50) / <alpha-value>)',
          100: 'rgb(var(--accent-100) / <alpha-value>)',
          200: 'rgb(var(--accent-200) / <alpha-value>)',
          300: 'rgb(var(--accent-300) / <alpha-value>)',
          400: 'rgb(var(--accent-400) / <alpha-value>)',
          500: 'rgb(var(--accent-500) / <alpha-value>)',
          600: 'rgb(var(--accent-600) / <alpha-value>)',
          700: 'rgb(var(--accent-700) / <alpha-value>)',
          800: 'rgb(var(--accent-800) / <alpha-value>)',
          900: 'rgb(var(--accent-900) / <alpha-value>)',
        },
      },
      borderRadius: {
        // driven by --radius-* css vars
        glass: 'var(--radius-glass)',
        sheet: 'var(--radius-sheet)',
        btn: 'var(--radius-btn)',
      },
      fontFamily: {
        ui: 'var(--font-ui)',
        display: 'var(--font-display)',
      },
      boxShadow: {
        glass: '0 8px 32px -8px rgb(0 0 0 / 0.12), 0 2px 6px -2px rgb(0 0 0 / 0.08)',
        'glass-lg': '0 24px 60px -12px rgb(0 0 0 / 0.18), 0 4px 12px -2px rgb(0 0 0 / 0.08)',
        'inner-glass': 'inset 0 1px 0 0 rgb(255 255 255 / 0.4)',
      },
      backdropBlur: {
        none: '0px',
        soft: '10px',
        medium: '20px',
        strong: '30px',
      },
      transitionTimingFunction: {
        spring: 'cubic-bezier(0.22, 1, 0.36, 1)',
      },
    },
  },
  plugins: [],
};
