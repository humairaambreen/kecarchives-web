import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        gray: {
          50: "#fafafa",
          100: "#f5f5f5",
          200: "#eaeaea",
          300: "#d4d4d4",
          400: "#999",
          500: "#888",
          600: "#666",
          700: "#444",
          800: "#333",
          900: "#111",
        },
      },
      borderRadius: {
        pill: "9999px",
      },
    },
  },
  plugins: [],
};

export default config;
