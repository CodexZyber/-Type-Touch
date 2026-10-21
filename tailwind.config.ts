import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        mac: {
          bg: "#0B0C0E",
          card: "rgba(22, 24, 29, 0.75)",
          cardHover: "rgba(30, 33, 40, 0.85)",
          border: "rgba(255, 255, 255, 0.08)",
          borderGlow: "rgba(255, 255, 255, 0.16)",
          subtle: "#1C1F26",
          textMuted: "#8E95A5",
          accent: "#F97316", // Tensor Orange
          accentHover: "#EA580C",
          accentGlow: "rgba(249, 115, 22, 0.25)",
          metal: "#E2E8F0",
          success: "#10B981",
          gold: "#F59E0B",
          silver: "#94A3B8",
          bronze: "#B45309",
          danger: "#EF4444",
        },
      },
      fontFamily: {
        sans: [
          "-apple-system",
          "BlinkMacSystemFont",
          '"SF Pro Display"',
          '"SF Pro Text"',
          '"Helvetica Neue"',
          "Helvetica",
          "Arial",
          "sans-serif",
        ],
        mono: [
          '"SF Mono"',
          "Menlo",
          "Monaco",
          '"Cascadia Code"',
          '"Courier New"',
          "monospace",
        ],
      },
      boxShadow: {
        "apple-card": "0 8px 32px 0 rgba(0, 0, 0, 0.37)",
        "keycap": "0 4px 0 0 rgba(0, 0, 0, 0.4), 0 5px 10px rgba(0, 0, 0, 0.3)",
        "keycap-pressed": "0 1px 0 0 rgba(0, 0, 0, 0.4), 0 2px 5px rgba(0, 0, 0, 0.3)",
        "glow-orange": "0 0 24px -4px rgba(249, 115, 22, 0.35)",
        "glow-gold": "0 0 24px -4px rgba(245, 158, 11, 0.4)",
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
