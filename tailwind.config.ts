import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        background: "var(--background)",
        foreground: "var(--foreground)",
        primary: {
          DEFAULT: "#D0021B",
          hover: "#A00016",
        },
        gold: "#C8A35F",
        base: "#FAF8F5",
        charcoal: "#1A1A1A",
        secondary: "#555555",
      },
      fontFamily: {
        sans: ["var(--font-inter)", "Inter", "Poppins", "Helvetica", "sans-serif"],
      },
      boxShadow: {
        card: "0 1px 3px rgba(0,0,0,0.08)",
        "card-hover": "0 4px 12px rgba(0,0,0,0.12)",
      },
      borderRadius: {
        button: "6px",
        badge: "5px",
        card: "10px",
      },
    },
  },
  plugins: [],
};
export default config;
