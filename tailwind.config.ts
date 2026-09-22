import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        ceramic: {
          DEFAULT: "#EAEFE6",
          card: "#EEF3EA",
          recessed: "#E2E8DE",
          border: "#D2DACB",
        },
        paper: "#EAEFE6",
        ink: "#171D19",
        line: "#D2DACB",
        slate: {
          ind: "#556057",
        },
        emerald: {
          DEFAULT: "#1E6B47",
          dark: "#144A31",
          light: "#D8E8DD",
        },
        gold: {
          DEFAULT: "#9E741E",
          light: "#F3EBD4",
        },
        brick: {
          DEFAULT: "#A94432",
          light: "#F4DFDA",
        },
      },
      fontFamily: {
        serif: ["var(--font-serif)", "Georgia", "serif"],
        sans: ["var(--font-sans)", "system-ui", "sans-serif"],
        mono: ["var(--font-mono)", "ui-monospace", "monospace"],
      },
      boxShadow: {
        neu: "7px 7px 16px rgba(180, 192, 175, 0.45), -7px -7px 16px rgba(255, 255, 255, 0.9)",
        "neu-sm": "4px 4px 9px rgba(180, 192, 175, 0.35), -4px -4px 9px rgba(255, 255, 255, 0.85)",
        "neu-inset": "inset 2px 2px 5px rgba(0, 0, 0, 0.06), inset -2px -2px 5px rgba(255, 255, 255, 0.75)",
        "neu-pill": "3px 3px 7px rgba(180, 192, 175, 0.35), -3px -3px 7px rgba(255, 255, 255, 0.85)",
        "neu-pill-active": "inset 2px 2px 4px rgba(0, 0, 0, 0.08), inset -2px -2px 4px rgba(255, 255, 255, 0.75)",
      },
    },
  },
  plugins: [],
};
export default config;
