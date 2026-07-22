/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        /* Primary identity — deep navy blue. */
        brand: {
          50: '#eef3fb',
          100: '#dbe5f6',
          200: '#b9cbeb',
          300: '#8ba9da',
          400: '#5b81c3',
          500: '#3a5fa6',
          600: '#2a4788',
          700: '#1f366c',
          800: '#172952',
          900: '#101c3a',
          950: '#080f22',
        },
        /* Secondary identity — brushed silver. */
        ocean: {
          50: '#f7f8fa',
          100: '#eef0f5',
          200: '#dfe3ea',
          300: '#c9cfdb',
          400: '#aab4c4',
          500: '#8c97a9',
          600: '#6f7b8e',
          700: '#586274',
          800: '#434c5c',
          900: '#2f3644',
        },
        ink: {
          50: '#f6f8fb',
          100: '#eef1f6',
          200: '#dfe4ec',
          300: '#c6ced9',
          400: '#939db0',
          500: '#66718a',
          600: '#4a5570',
          700: '#333d57',
          800: '#1d2740',
          900: '#0d1526',
        },
      },
      fontFamily: {
        sans: ['Plus Jakarta Sans', 'Cairo', 'system-ui', 'sans-serif'],
        arabic: ['Cairo', 'Plus Jakarta Sans', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'Fira Code', 'monospace'],
      },
      fontSize: {
        '2xs': ['0.6875rem', { lineHeight: '1rem' }],
      },
      boxShadow: {
        card: '0 1px 2px 0 rgb(13 21 38 / 0.04), 0 1px 3px 0 rgb(13 21 38 / 0.06)',
        'card-hover': '0 10px 30px -12px rgb(13 21 38 / 0.20), 0 4px 8px -4px rgb(13 21 38 / 0.07)',
        float: '0 18px 44px -20px rgb(31 54 108 / 0.55)',
        silver: '0 10px 26px -14px rgb(88 98 116 / 0.55)',
        ring: '0 0 0 4px rgb(58 95 166 / 0.14)',
      },
      backgroundImage: {
        /* THE signature gradient: dark blue → silver.
           Stops short of pale silver so white text/icons stay ≥4.5:1 on it. */
        'grad-brand': 'linear-gradient(135deg, #080f22 0%, #1f366c 40%, #3a5fa6 70%, #6f7b8e 100%)',
        'grad-brand-soft':
          'linear-gradient(135deg, #eef3fb 0%, #f2f4f8 45%, #f7f8fa 75%, #eef0f5 100%)',
        'grad-steel': 'linear-gradient(135deg, #172952 0%, #586274 55%, #c9cfdb 100%)',
        'grad-ocean': 'linear-gradient(135deg, #2f3644 0%, #586274 55%, #8c97a9 100%)',
        'grad-silver': 'linear-gradient(135deg, #6f7b8e 0%, #aab4c4 50%, #eef0f5 100%)',
        'grad-sun': 'linear-gradient(135deg, #b45309 0%, #f59e0b 100%)',
        'grad-rose': 'linear-gradient(135deg, #9f1239 0%, #f43f5e 100%)',
        'grad-violet': 'linear-gradient(135deg, #4c1d95 0%, #8b5cf6 100%)',
        'grad-emerald': 'linear-gradient(135deg, #065f46 0%, #10b981 100%)',
        'grad-mesh':
          'radial-gradient(at 0% 0%, rgba(31,54,108,0.14) 0px, transparent 55%), radial-gradient(at 98% 2%, rgba(140,151,169,0.18) 0px, transparent 50%), radial-gradient(at 50% 100%, rgba(91,129,195,0.10) 0px, transparent 55%)',
      },
      keyframes: {
        shimmer: { '100%': { transform: 'translateX(100%)' } },
        'float-slow': {
          '0%,100%': { transform: 'translateY(0) scale(1)' },
          '50%': { transform: 'translateY(-18px) scale(1.04)' },
        },
      },
      animation: {
        shimmer: 'shimmer 1.6s infinite',
        'float-slow': 'float-slow 9s ease-in-out infinite',
      },
    },
  },
  plugins: [],
};
