/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        sidebar: {
          bg: '#1a1d21',
          hover: '#27292d',
          active: '#1164A3',
          border: '#2d2f33',
          text: '#d1d2d3',
          muted: '#868686',
        },
        chat: {
          bg: '#ffffff',
          input: '#f8f8f8',
          border: '#e8e8e8',
        },
        brand: {
          primary: '#1164A3',
          hover: '#0d5291',
          light: '#e8f4fd',
        },
      },
      fontFamily: {
        sans: [
          'Slack-Lato',
          '-apple-system',
          'BlinkMacSystemFont',
          'Segoe UI',
          'Helvetica',
          'Arial',
          'sans-serif',
        ],
      },
      animation: {
        'slide-in-right': 'slideInRight 0.2s ease-out',
        'fade-in': 'fadeIn 0.15s ease-out',
        'scale-in': 'scaleIn 0.1s ease-out',
      },
      keyframes: {
        slideInRight: {
          from: { transform: 'translateX(100%)', opacity: 0 },
          to: { transform: 'translateX(0)', opacity: 1 },
        },
        fadeIn: {
          from: { opacity: 0 },
          to: { opacity: 1 },
        },
        scaleIn: {
          from: { transform: 'scale(0.95)', opacity: 0 },
          to: { transform: 'scale(1)', opacity: 1 },
        },
      },
    },
  },
  plugins: [],
}
