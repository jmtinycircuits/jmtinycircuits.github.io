module.exports = {
  content: ['./src/**/*.{html,js}',
            './dist/js/**/*.{html,js}'],
  theme: {
    extend: {},
    screens: {
      'tiny': '320px',
      'sm': '640px',
      'md': '768px',
      'lg': '1024px',
      'xl': '1280px',
      '2xl': '1536px',
    },
  },
  plugins: [require("daisyui")],
}