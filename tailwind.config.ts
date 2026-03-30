import type { Config } from 'tailwindcss'

const config: Config = {
  // O content diz ao Tailwind para procurar classes nestes arquivos
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          50:  '#E8F8F5',
          100: '#C3EDE6',
          200: '#86D9CC',
          400: '#2CBFAB',
          500: '#1AAF9A',
          600: '#0F9E89',
          700: '#0A8A77',
        },
        surface: '#FFFFFF',
        page:    '#F0F7F6',
        input:   '#F8FAFA',
        border: {
          DEFAULT: '#E8EEEE',
          input:   '#D4DFDE',
        },
        text: {
          primary:   '#1A2E2B',
          secondary: '#637370',
          tertiary:  '#9BB0AD',
          link:      '#1AAF9A',
        },
      },
      fontFamily: {
        sans: ['DM Sans', 'sans-serif'],
      },
      fontSize: {
        '2xs': ['11px', { lineHeight: '1.4' }],
        xs:    ['13px', { lineHeight: '1.5' }],
        sm:    ['14px', { lineHeight: '1.5' }],
        base:  ['15px', { lineHeight: '1.6' }],
        lg:    ['17px', { lineHeight: '1.4' }],
        xl:    ['20px', { lineHeight: '1.3' }],
        '2xl': ['24px', { lineHeight: '1.2' }],
        '3xl': ['28px', { lineHeight: '1.1' }],
      },
      borderRadius: {
        sm:   '6px',
        DEFAULT: '10px',
        md:   '10px',
        lg:   '14px',
        xl:   '20px',
      },
      boxShadow: {
        xs: '0 1px 3px rgba(26, 46, 43, 0.06)',
        sm: '0 2px 8px rgba(26, 46, 43, 0.08)',
        md: '0 4px 16px rgba(26, 46, 43, 0.10)',
        lg: '0 8px 32px rgba(26, 46, 43, 0.12)',
      },
    },
  },
  plugins: [],
}

export default config