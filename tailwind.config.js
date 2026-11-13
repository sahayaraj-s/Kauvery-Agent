/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        kauvery: {
          deep: '#100311',
          obsidian: '#0A020B',
          darkplum: '#3A0529',
          plum: '#6B0F48',
          richplum: '#7C0E52',
          magenta: '#D80064',
          fuchsia: '#E6007A',
          pink: '#F52F89',
          coral: '#F85A28',
          orange: '#FF6F22',
          amber: '#FFB81C',
          gold: '#FFC83B',
          surface: 'rgba(26, 7, 24, 0.72)',
          surfaceHover: 'rgba(48, 12, 43, 0.85)',
          glassBorder: 'rgba(216, 0, 100, 0.22)',
          glassBorderBright: 'rgba(255, 184, 28, 0.45)',
        }
      },
      fontFamily: {
        sans: ['"Plus Jakarta Sans"', 'Inter', 'system-ui', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'monospace'],
      },
      boxShadow: {
        'kauvery-glow': '0 0 35px -5px rgba(216, 0, 100, 0.45), 0 0 15px -3px rgba(248, 90, 40, 0.35)',
        'kauvery-amber': '0 0 30px -4px rgba(255, 184, 28, 0.5)',
        'kauvery-coral': '0 0 30px -4px rgba(248, 90, 40, 0.5)',
        'kauvery-card': '0 20px 50px -12px rgba(16, 3, 17, 0.85), 0 0 0 1px rgba(216, 0, 100, 0.2)',
      },
      animation: {
        'pulse-slow': 'pulse 3.5s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'float-gentle': 'floatGentle 4s ease-in-out infinite',
        'glow-breathe': 'glowBreathe 3s ease-in-out infinite alternate',
        'spin-slow': 'spin 8s linear infinite',
      },
      keyframes: {
        floatGentle: {
          '0%, 100%': { transform: 'translateY(0px)' },
          '50%': { transform: 'translateY(-8px)' },
        },
        glowBreathe: {
          '0%': { filter: 'drop-shadow(0 0 12px rgba(216, 0, 100, 0.4))' },
          '100%': { filter: 'drop-shadow(0 0 28px rgba(255, 184, 28, 0.7))' },
        }
      }
    },
  },
  plugins: [],
}
