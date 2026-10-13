/**
 * Token desain (lihat DESIGN.md). Nilai hanya didefinisikan di sini dan di
 * `src/styles/index.css`; komponen memakai nama token, bukan nilai mentah.
 */
/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'Segoe UI', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'Consolas', 'ui-monospace', 'monospace'],
      },
      colors: {
        brand: {
          50: '#F0FDFA',
          100: '#CCFBF1',
          200: '#99F6E4',
          300: '#5EEAD4',
          400: '#2DD4BF',
          500: '#14B8A6',
          600: '#0D9488',
          700: '#0F766E',
          800: '#115E59',
          900: '#134E4A',
        },
        canvas: '#F6F8FA',
        surface: '#FFFFFF',
        surface2: '#F1F5F9',
        line: '#E2E8F0',
        'line-input': '#7B8BA3',
        ink: '#0F172A',
        'ink-2': '#475569',
        'ink-3': '#64748B',
        success: { DEFAULT: '#15803D', bg: '#DCFCE7' },
        warning: { DEFAULT: '#B45309', bg: '#FEF3C7' },
        danger: { DEFAULT: '#B91C1C', bg: '#FEE2E2' },
        info: { DEFAULT: '#1D4ED8', bg: '#DBEAFE' },
      },
      borderRadius: {
        sm: '6px',
        md: '10px',
        lg: '16px',
      },
      boxShadow: {
        sm: '0 1px 2px rgba(15,23,42,.06), 0 1px 3px rgba(15,23,42,.08)',
        md: '0 4px 12px rgba(15,23,42,.08)',
        lg: '0 16px 40px rgba(15,23,42,.14)',
      },
      fontSize: {
        // Skala tipe DESIGN.md: tabel rapat untuk aplikasi admin.
        caption: ['12px', '16px'],
        label: ['14px', '20px'],
        'body-sm': ['14px', '20px'],
        body: ['15px', '22px'],
        'body-lg': ['17px', '26px'],
        h3: ['19px', '26px'],
        h2: ['23px', '30px'],
        h1: ['28px', '36px'],
        display: ['36px', '44px'],
      },
    },
  },
  plugins: [],
};
