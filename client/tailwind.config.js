/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Brand blue — drawn from the AuraOS icon "A"
        brand: {
          50:  '#eff5ff',
          100: '#dbe8fe',
          200: '#bfd7fe',
          300: '#93bbfd',
          400: '#6094fa',
          500: '#3b71f6',
          600: '#2456eb',
          700: '#1d43d8',
          800: '#1e39af',
          900: '#1e348a',
          950: '#172153',
        },
        // Warm amber accent — the swoosh + "OS" in the icon
        accent: {
          50:  '#fffbeb',
          100: '#fef3c7',
          200: '#fde68a',
          300: '#fcd34d',
          400: '#fbbf24',
          500: '#f59e0b',
          600: '#d97706',
          700: '#b45309',
          800: '#92400e',
          900: '#78350f',
        },
        // Deep navy — sidebar / dark surfaces (matches icon background)
        navy: {
          50:  '#f4f6fb',
          100: '#e8edf6',
          200: '#cbd6ea',
          300: '#9db1d6',
          400: '#6884bd',
          500: '#4661a3',
          600: '#354b87',
          700: '#2c3d6e',
          800: '#1d2a4d',
          900: '#111d3a',
          950: '#0b1428',
        },
        primary: {
          25: '#f5f3ff',
          50: '#eff6ff',
          100: '#e0e7ff',
          200: '#c7d2fe',
          300: '#a5b4fc',
          400: '#818cf8',
          500: '#6366f1',
          600: '#4f46e5',
          700: '#4338ca',
          800: '#3730a3',
          900: '#312e81',
        },
        success: {
          50: '#f0fdf4',
          100: '#dcfce7',
          500: '#22c55e',
          600: '#16a34a',
          700: '#15803d',
        },
        warning: {
          50: '#fffbeb',
          100: '#fef3c7',
          500: '#eab308',
          600: '#ca8a04',
          700: '#a16207',
        },
        danger: {
          50: '#fef2f2',
          100: '#fee2e2',
          500: '#ef4444',
          600: '#dc2626',
          700: '#b91c1c',
        },
        info: {
          50: '#f0f9ff',
          100: '#e0f2fe',
          500: '#0ea5e9',
          600: '#0284c7',
          700: '#0369a1',
        }
      },
      typography: {
        DEFAULT: {
          css: {
            'h1': {
              fontSize: '2.25rem',
              fontWeight: '700',
              lineHeight: '2.5rem',
            },
            'h2': {
              fontSize: '1.875rem',
              fontWeight: '700',
              lineHeight: '2.25rem',
            },
            'h3': {
              fontSize: '1.5rem',
              fontWeight: '600',
              lineHeight: '2rem',
            },
            'h4': {
              fontSize: '1.25rem',
              fontWeight: '600',
              lineHeight: '1.75rem',
            },
            'body': {
              fontSize: '1rem',
              fontWeight: '400',
              lineHeight: '1.5rem',
            },
            'small': {
              fontSize: '0.875rem',
              fontWeight: '400',
              lineHeight: '1.25rem',
            },
            'xs': {
              fontSize: '0.75rem',
              fontWeight: '400',
              lineHeight: '1rem',
            },
          }
        }
      },
      spacing: {
        '0': '0',
        '1': '0.25rem',
        '2': '0.5rem',
        '3': '0.75rem',
        '4': '1rem',
        '5': '1.25rem',
        '6': '1.5rem',
        '8': '2rem',
        '10': '2.5rem',
        '12': '3rem',
        '16': '4rem',
        '20': '5rem',
        '24': '6rem',
        '32': '8rem',
      },
      animation: {
        'spin': 'spin 1s linear infinite',
        'pulse': 'pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'bounce': 'bounce 1s infinite',
        'ping': 'ping 1s cubic-bezier(0, 0, 0.2, 1) infinite',
      },
      boxShadow: {
        'sm': '0 1px 2px 0 rgba(16, 24, 40, 0.05)',
        'DEFAULT': '0 1px 3px 0 rgba(16, 24, 40, 0.08), 0 1px 2px -1px rgba(16, 24, 40, 0.06)',
        'md': '0 4px 8px -2px rgba(16, 24, 40, 0.08), 0 2px 4px -2px rgba(16, 24, 40, 0.04)',
        'lg': '0 12px 16px -4px rgba(16, 24, 40, 0.08), 0 4px 6px -2px rgba(16, 24, 40, 0.03)',
        'xl': '0 20px 24px -4px rgba(16, 24, 40, 0.10), 0 8px 8px -4px rgba(16, 24, 40, 0.04)',
        '2xl': '0 24px 48px -12px rgba(16, 24, 40, 0.18)',
        'card': '0 1px 3px rgba(16, 24, 40, 0.06), 0 1px 2px rgba(16, 24, 40, 0.04)',
        'card-hover': '0 8px 24px -4px rgba(16, 24, 40, 0.12), 0 2px 6px -2px rgba(16, 24, 40, 0.06)',
        'glow-brand': '0 0 0 4px rgba(59, 113, 246, 0.12)',
      },
      borderRadius: {
        '4xl': '2rem',
      },
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui', '-apple-system', 'Segoe UI', 'sans-serif'],
      },
    },
  },
  plugins: [],
  darkMode: 'class',
}