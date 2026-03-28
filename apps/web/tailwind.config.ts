import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: ["class"],
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        brand: {
          50: "#eff9ff",
          100: "#dff2ff",
          200: "#b8e6ff",
          300: "#79d3ff",
          400: "#32bcff",
          500: "#00a3f5",
          600: "#007bc4",
          700: "#0363a1",
          800: "#085583",
          900: "#0d476d",
        },
        danger: "#ef4444",
        warning: "#f59e0b",
        success: "#10b981",
      },
      fontFamily: {
        sans: ["IBM Plex Sans", "Segoe UI", "sans-serif"],
        mono: ["IBM Plex Mono", "Consolas", "monospace"],
      },
    },
  },
  plugins: [],
};

export default config;
