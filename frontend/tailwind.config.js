/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        neo: {
          bg: '#0a0b0e',
          card: '#12141a',
          surface: '#181b24',
          border: '#242938',
          accent: '#6366f1',
          accentHover: '#4f46e5',
          gold: '#f59e0b',
          cyan: '#06b6d4',
          purple: '#a855f7',
        }
      }
    },
  },
  plugins: [],
}
