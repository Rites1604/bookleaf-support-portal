import type { Config } from "tailwindcss";

export default {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        // BookLeaf brand coral (#F16876 on bookleafpub.com) as a full scale.
        brand: {
          50: "#FEF2F3",
          100: "#FDE3E6",
          200: "#FBCBD0",
          300: "#F8A5AE",
          400: "#F48390",
          500: "#F16876",
          600: "#DE4A5B",
          700: "#BA3A4A",
          800: "#9A3341",
          900: "#812F3B",
        },
        // Charcoal and grey used for BookLeaf's headings and wordmark.
        ink: { DEFAULT: "#2F2E2E", muted: "#605E5E" },
      },
      fontFamily: {
        sans: ["var(--font-sans)", "Avenir", "system-ui", "sans-serif"],
      },
    },
  },
  plugins: [],
} satisfies Config;
