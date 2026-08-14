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
        "gold-light": "#fffdf0",
        "gold-dark": "#92610a",
        "red-light": "#fff1f2",
        base: "#FAF8F5",
        charcoal: "#1A1A1A",
        secondary: "#555555",
        muted: "#555",
        subtle: "#888",
        divider: "var(--divider)",
        "border-light": "#f0ece6",
      },
      fontFamily: {
        sans: ["var(--font-sans)", "DM Sans", "system-ui", "sans-serif"],
        serif: ["var(--font-serif)", "DM Serif Display", "Georgia", "serif"],
      },
      boxShadow: {
        card: "0 1px 3px rgba(0,0,0,0.08)",
        "card-hover": "0 8px 24px rgba(0,0,0,0.10)",
      },
      borderRadius: {
        button: "8px",
        badge: "999px",
        card: "16px",
        bento: "20px",
      },
      gridTemplateColumns: {
        bento: "repeat(6, 1fr)",
      },
    },
  },
  plugins: [],
};
export default config;
