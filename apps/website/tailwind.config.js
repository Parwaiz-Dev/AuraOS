/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      // Per-tenant theme is injected as CSS variables at request time, so Tailwind
      // utilities can reference them (e.g. bg-[var(--brand-primary)]).
      colors: {
        brand: {
          primary: 'var(--brand-primary)',
          secondary: 'var(--brand-secondary)',
          accent: 'var(--brand-accent)',
        },
      },
    },
  },
  plugins: [],
};
