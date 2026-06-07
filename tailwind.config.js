/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        kiddo: {
          green: '#16A34A',
          navy: '#111827',
          muted: '#6B7280',
          border: '#E5E7EB',
          surface: '#FFFFFF',
          bg: '#F8F9FA',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
      },
      borderRadius: {
        card: '10px',
      },
    },
  },
  plugins: [],
}
