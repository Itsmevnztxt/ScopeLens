/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['"Plus Jakarta Sans"', 'system-ui', '-apple-system', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'ui-monospace', 'SFMono-Regular', 'monospace'],
      },
      colors: {
        canvas: '#F6F4FB',
        surface: '#FFFFFF',
        subtle: '#EFEBF9',
        borderSoft: '#ECE8F6',
        ink: '#1E1B2E',
        inkMuted: '#5E5873',
        violetPrimary: '#8B5CF6',
        violetDeep: '#7C3AED',
        lavenderSoft: '#A78BFA',
        lavenderTint: '#F3EEFF',
      },
      boxShadow: {
        card: '0 10px 30px -10px rgba(109, 40, 217, 0.08)',
        cardHover: '0 16px 36px -12px rgba(109, 40, 217, 0.14)',
        rail: '0 12px 32px -12px rgba(109, 40, 217, 0.10)',
      },
      transitionTimingFunction: {
        studio: 'cubic-bezier(0.22, 1, 0.36, 1)',
      },
    },
  },
  plugins: [],
};
