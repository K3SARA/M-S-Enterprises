/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        ms: {
          blue: '#0C3B9B',
          'blue-hover': '#082C78',
          'blue-dark': '#051C52',
          'blue-light': '#EEF3FF',
          gold: '#C59B27',
          'gold-hover': '#A8811C',
          'gold-dark': '#8A670F',
          'gold-light': '#FDF8EA',
          'gold-border': '#E4C76C',
        },
        brand: {
          blue: '#0C3B9B',
          'blue-hover': '#082C78',
          gold: '#C59B27',
          'gold-hover': '#A8811C',
          'gold-light': '#FDF8EA',
        },
        gold: {
          50: '#FDFBF5',
          100: '#FDF8EA',
          200: '#F7ECC8',
          300: '#EED99E',
          400: '#DEC06B',
          500: '#C59B27',
          600: '#A8811C',
          700: '#8A670F',
          800: '#6C4F0C',
          900: '#4D3708',
        },
        apple: {
          blue: '#0C3B9B',
          'blue-hover': '#082C78',
          gold: '#C59B27',
          gray: '#F1F3F6',
          dark: '#1D1D1F',
          subtext: '#86868B',
          card: '#FFFFFF',
          border: 'rgba(0,0,0,0.08)'
        },
        slate: {
          '750': '#293548',
        }
      },
      fontFamily: {
        sans: [
          '"Plus Jakarta Sans"',
          '-apple-system',
          'BlinkMacSystemFont',
          '"Segoe UI"',
          'Roboto',
          'Helvetica',
          'Arial',
          'sans-serif'
        ],
        mono: [
          '"JetBrains Mono"',
          'ui-monospace',
          'SFMono-Regular',
          'Menlo',
          'Monaco',
          'Consolas',
          'monospace'
        ]
      },
      zIndex: {
        '60': '60',
        '70': '70',
        '80': '80',
        '90': '90',
        '100': '100',
      },
      boxShadow: {
        '3xs': '0 1px 1px 0 rgba(0, 0, 0, 0.02)',
        '2xs': '0 1px 2px 0 rgba(0, 0, 0, 0.03)',
        'xs': '0 1px 2px 0 rgba(0, 0, 0, 0.05)',
      },
      backdropBlur: {
        'xs': '2px',
      },
      scale: {
        '98': '0.98',
      },
      spacing: {
        '0.2': '0.05rem',
        '4.5': '1.125rem',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideIn: {
          '0%': { transform: 'translateY(-10px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
        scaleIn: {
          '0%': { transform: 'scale(0.95)', opacity: '0' },
          '100%': { transform: 'scale(1)', opacity: '1' },
        },
        scaleUp: {
          '0%': { transform: 'scale(0.95)', opacity: '0' },
          '100%': { transform: 'scale(1)', opacity: '1' },
        },
      },
      animation: {
        fadeIn: 'fadeIn 0.2s ease-out forwards',
        slideIn: 'slideIn 0.2s ease-out forwards',
        scaleIn: 'scaleIn 0.2s ease-out forwards',
        scaleUp: 'scaleUp 0.2s ease-out forwards',
      }
    },
  },
  plugins: [],
}
