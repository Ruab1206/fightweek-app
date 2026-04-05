/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      colors: {
        // JPD / Atlassian-inspired palette (matches Toolbox)
        brand: {
          50:  '#E9F2FF',
          100: '#CCE0FF',
          500: '#0052CC',
          600: '#0747A6',
          700: '#003884',
        },
        surface: {
          DEFAULT: '#FFFFFF',
          subtle:  '#FAFBFC',
          raised:  '#F4F5F7',
          hover:   '#EBECF0',
          border:  '#DFE1E6',
        },
        'ds-text': {
          DEFAULT:   '#172B4D',
          subtle:    '#6B778C',
          subtlest:  '#97A0AF',
          inverse:   '#FFFFFF',
        },
      },
    },
  },
  plugins: [],
}