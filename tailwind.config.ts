import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        brand: {
          50: "#eefdf3",
          100: "#d6f9e1",
          200: "#aff1c6",
          300: "#79e4a4",
          400: "#3fce7c",
          500: "#17b35e",
          600: "#0b914b",
          700: "#0a733e",
          800: "#0c5b34",
          900: "#0b4a2c",
        },
      },
      fontFamily: {
        sans: ["var(--font-sans)", "system-ui", "sans-serif"],
      },
    },
  },
  plugins: [],
};

export default config;
