import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        ceramic: {
          DEFAULT: "var(--bg-app)",
          card: "var(--bg-card)",
          recessed: "var(--bg-recessed)",
          border: "var(--border-line)",
        },
        paper: "var(--bg-app)",
        ink: "var(--text-main)",
        line: "var(--border-line)",
        slate: {
          ind: "var(--text-muted)",
        },
        emerald: {
          DEFAULT: "var(--accent-emerald)",
          dark: "var(--accent-emerald-dark)",
          light: "rgba(16, 185, 129, 0.15)",
        },
        gold: {
          DEFAULT: "var(--accent-gold)",
          light: "rgba(245, 158, 11, 0.15)",
        },
        brick: {
          DEFAULT: "var(--accent-brick)",
          light: "rgba(239, 68, 68, 0.15)",
        },
      },
      fontFamily: {
        serif: ["var(--font-serif)", "Georgia", "serif"],
        sans: ["var(--font-sans)", "system-ui", "sans-serif"],
        mono: ["var(--font-mono)", "ui-monospace", "monospace"],
      },
      boxShadow: {
        neu: "var(--shadow-neu)",
        "neu-sm": "var(--shadow-neu-sm)",
        "neu-inset": "var(--shadow-neu-inset)",
        "neu-pill": "var(--shadow-neu-pill)",
        "neu-pill-active": "var(--shadow-neu-pill-active)",
      },
    },
  },
  plugins: [],
};
export default config;
