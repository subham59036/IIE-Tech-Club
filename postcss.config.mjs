/** @type {import('postcss').Config} */
const config = {
  plugins: {
    // Tailwind v4 uses its own PostCSS plugin
    "@tailwindcss/postcss": {},
  },
};

export default config;
