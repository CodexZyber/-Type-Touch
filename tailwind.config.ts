import type { Config } from "tailwindcss";

// Tensor School brand: light surfaces, slate text, indigo primary (#4338ca = indigo-700),
// green chevron accent from the logo, amber reserved for podium gold.
const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          bg: "#f7f6fa",
          ink: "#0f172a",
          muted: "#4b5563",
          indigo: "#4338ca",
          indigoDark: "#3730a3",
          indigoSoft: "#eef2ff",
          violet: "#7c3aed",
          green: "#1ecc90",
          navy: "#0f0a2a",
        },
      },
      fontFamily: {
        sans: [
          '"Plus Jakarta Sans"',
          "Inter",
          "ui-sans-serif",
          "system-ui",
          "-apple-system",
          '"Segoe UI"',
          "Roboto",
          "Helvetica",
          "Arial",
          "sans-serif",
        ],
        mono: [
          "ui-monospace",
          "SFMono-Regular",
          "Menlo",
          "Monaco",
          "Consolas",
          '"Liberation Mono"',
          '"Courier New"',
          "monospace",
        ],
      },
      boxShadow: {
        card: "0 1px 2px rgba(15, 23, 42, 0.04), 0 10px 30px -16px rgba(15, 23, 42, 0.12)",
        "card-lg": "0 2px 4px rgba(15, 23, 42, 0.04), 0 24px 48px -20px rgba(15, 23, 42, 0.18)",
        "glow-indigo": "0 8px 24px -8px rgba(67, 56, 202, 0.45)",
        "glow-gold": "0 8px 24px -10px rgba(245, 158, 11, 0.45)",
      },
      animation: {
        "pulse-subtle": "pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite",
        "fade-in": "fadeIn 0.3s ease-out forwards",
      },
      keyframes: {
        fadeIn: {
          "0%": { opacity: "0", transform: "translateY(6px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
      },
    },
  },
  plugins: [],
};

export default config;
