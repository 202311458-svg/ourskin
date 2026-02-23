/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/app/**/*.{js,ts,jsx,tsx}",
    "./src/components/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        body: ['Cal Sans', 'sans-serif'],
        heading: ['Poppins', 'sans-serif'],
      },
      colors: {
        primary: '#82334c',
        background: '#f6f5f3',
      },
      keyframes: {
        fadeInUp: {
          '0%': { opacity: 0, transform: 'translateY(20px)' },
          '100%': { opacity: 1, transform: 'translateY(0)' },
        },
        pulseSlow: {
          '0%, 100%': { transform: 'scale(1)', opacity: 0.4 },
          '50%': { transform: 'scale(1.1)', opacity: 0.2 },
        },
      },
      animation: {
        fadeInUp: 'fadeInUp 0.8s ease forwards',
        pulseSlow: 'pulseSlow 6s ease-in-out infinite',
      },
    },
  },
  plugins: [],
}