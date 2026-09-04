/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx,ts,tsx}"],
  theme: {
    extend: {
      colors: {
        faurlund: {
          green: "#4d7c0f",
          dark: "#3f660c",
          bright: "#5a9e24",
          lime: "#8cbe3f",
          sage: "#dfe6cf",
          charcoal: "#454542",
        },
      },
    },
  },
  plugins: [],
};
