import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/providers/**/*.{js,ts,jsx,tsx,mdx}"
  ],
  theme: {
    extend: {
      colors: {
        primaryBlue: "#2563EB",
        primaryYellow: "#FACC15",
        primaryRed: "#DC2626",
        secondaryPurple: "#7C3AED",
        secondaryTeal: "#0D9488",
        backgroundDark: "#0B1020",
        surfaceDark: "#111827",
        surfaceLight: "#1F2937",
        textPrimary: "#F9FAFB",
        textSecondary: "#9CA3AF",
        successTone: "#16A34A",
        warningTone: "#F59E0B",
        dangerTone: "#EF4444"
      },
      boxShadow: {
        surface: "0 16px 40px color-mix(in srgb, black 42%, transparent)"
      },
      borderRadius: {
        card: "14px"
      }
    }
  },
  plugins: []
};

export default config;
