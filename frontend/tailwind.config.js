/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{vue,js}"],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        orange: {
          400: "#ffb37a",
          500: "#ff7a1a",
          600: "#e0640a",
        },
        pink: {
          500: "#ff2d78",
        },
      },
    },
  },
  plugins: [],
};
