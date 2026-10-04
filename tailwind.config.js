/** @type {import('tailwindcss').Config} */

/** Semantic color backed by an HSL-channel CSS variable, so opacity modifiers (bg-primary/10) work. */
const token = (name) => `hsl(var(--${name}) / <alpha-value>)`;

/** Status tone: `X` strong tone, `X-foreground` text on solid X, `X-muted` restrained tint. */
const tone = (name) => ({
  DEFAULT: token(name),
  foreground: token(`${name}-foreground`),
  muted: token(`${name}-muted`),
});

const brandSteps = [50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950];

export default {
  darkMode: ["class"],
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    container: {
      center: true,
      padding: "2rem",
      screens: { "2xl": "1400px" },
    },
    extend: {
      colors: {
        background: token("background"),
        foreground: token("foreground"),
        surface: {
          DEFAULT: token("surface"),
          muted: token("surface-muted"),
          raised: token("surface-raised"),
        },
        card: {
          DEFAULT: token("card"),
          foreground: token("card-foreground"),
        },
        popover: {
          DEFAULT: token("popover"),
          foreground: token("popover-foreground"),
        },
        primary: {
          DEFAULT: token("primary"),
          hover: token("primary-hover"),
          active: token("primary-active"),
          foreground: token("primary-foreground"),
          muted: token("primary-muted"),
          "muted-foreground": token("primary-muted-foreground"),
        },
        secondary: {
          DEFAULT: token("secondary"),
          foreground: token("secondary-foreground"),
        },
        muted: {
          DEFAULT: token("muted"),
          foreground: token("muted-foreground"),
        },
        "subtle-foreground": token("subtle-foreground"),
        accent: {
          DEFAULT: token("accent"),
          foreground: token("accent-foreground"),
        },
        success: tone("success"),
        warning: tone("warning"),
        danger: tone("danger"),
        info: tone("info"),
        neutral: tone("neutral"),
        destructive: {
          DEFAULT: token("destructive"),
          foreground: token("destructive-foreground"),
        },
        border: token("border"),
        input: token("input"),
        ring: token("ring"),
        overlay: token("overlay"),
        chart: {
          1: token("chart-1"),
          2: token("chart-2"),
          3: token("chart-3"),
          4: token("chart-4"),
          5: token("chart-5"),
          grid: token("chart-grid"),
          axis: token("chart-axis"),
          tooltip: token("chart-tooltip"),
          "tooltip-foreground": token("chart-tooltip-foreground"),
        },
        sidebar: {
          DEFAULT: token("sidebar"),
          foreground: token("sidebar-foreground"),
          muted: token("sidebar-muted"),
          active: token("sidebar-active"),
          "active-foreground": token("sidebar-active-foreground"),
          border: token("sidebar-border"),
          hover: token("sidebar-hover"),
        },
        brand: Object.fromEntries(brandSteps.map((step) => [step, token(`brand-${step}`)])),
      },
      fontFamily: {
        sans: ["Inter Variable", "Noto Sans Arabic Variable", "Segoe UI", "system-ui", "sans-serif"],
        mono: ["ui-monospace", "Cascadia Code", "SFMono-Regular", "Consolas", "monospace"],
      },
      fontSize: {
        // Table cells and form labels. Registered with tailwind-merge in src/lib/utils.ts.
        ui: ["13px", { lineHeight: "20px" }],
      },
      borderRadius: {
        sm: "4px",
        DEFAULT: "6px",
        md: "6px",
        lg: "8px",
        xl: "10px",
        "2xl": "12px",
        "3xl": "12px",
      },
      boxShadow: {
        xs: "var(--shadow-xs)",
        sm: "var(--shadow-sm)",
        DEFAULT: "var(--shadow-sm)",
        md: "var(--shadow-md)",
        lg: "var(--shadow-lg)",
        // Flattened on purpose: the console uses borders over heavy elevation.
        xl: "var(--shadow-lg)",
        "2xl": "var(--shadow-lg)",
        focus: "0 0 0 3px hsl(var(--ring) / 0.3)",
      },
      keyframes: {
        "progress-indeterminate": {
          "0%": { transform: "translateX(-100%)" },
          "100%": { transform: "translateX(250%)" },
        },
        "overlay-in": {
          from: { opacity: "0" },
          to: { opacity: "1" },
        },
        "content-in": {
          from: { opacity: "0", transform: "translateY(4px) scale(0.99)" },
          to: { opacity: "1", transform: "translateY(0) scale(1)" },
        },
        "sheet-in": {
          from: { transform: "translateX(16px)", opacity: "0" },
          to: { transform: "translateX(0)", opacity: "1" },
        },
      },
      animation: {
        "progress-indeterminate": "progress-indeterminate 1.4s ease-in-out infinite",
        "overlay-in": "overlay-in 120ms ease-out",
        "content-in": "content-in 140ms ease-out",
        "sheet-in": "sheet-in 160ms ease-out",
      },
    },
  },
  plugins: [],
};
