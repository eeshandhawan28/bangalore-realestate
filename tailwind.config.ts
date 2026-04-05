import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        background: "var(--color-bg)",
        foreground: "var(--color-text)",
        surface: "var(--color-surface)",
        primary: {
          DEFAULT: "var(--color-primary)",
          hover: "var(--color-primary-hover)",
          highlight: "var(--color-primary-highlight)",
          foreground: "var(--color-primary-fg)",
        },
        overpriced: "var(--color-overpriced)",
        fair: "var(--color-fair)",
        underpriced: "var(--color-underpriced)",
        border: "var(--color-border)",
        muted: {
          DEFAULT: "var(--color-muted)",
          foreground: "var(--color-muted-fg)",
        },
        card: {
          DEFAULT: "var(--color-surface)",
          foreground: "var(--color-text)",
        },
        popover: {
          DEFAULT: "var(--color-surface)",
          foreground: "var(--color-text)",
        },
        secondary: {
          DEFAULT: "var(--color-secondary)",
          foreground: "var(--color-secondary-fg)",
        },
        accent: {
          DEFAULT: "var(--color-primary-highlight)",
          foreground: "var(--color-primary)",
        },
        destructive: {
          DEFAULT: "var(--color-overpriced)",
          foreground: "#ffffff",
        },
        input: "var(--color-border)",
        ring: "var(--color-primary)",
      },
      fontFamily: {
        display: ["Clash Display", "Inter", "sans-serif"],
        body: ["Satoshi", "Inter", "sans-serif"],
        sans: ["Satoshi", "Inter", "sans-serif"],
      },
      maxWidth: {
        content: "1200px",
      },
      boxShadow: {
        sm: "0 1px 3px 0 rgb(0 0 0 / 0.06), 0 1px 2px -1px rgb(0 0 0 / 0.06)",
        md: "0 4px 12px 0 rgb(0 0 0 / 0.10), 0 2px 4px -2px rgb(0 0 0 / 0.06)",
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
    },
  },
  plugins: [],
};
export default config;
