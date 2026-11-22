/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['"Space Grotesk"', 'Inter', 'system-ui', '-apple-system', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'ui-monospace', 'SFMono-Regular', 'Menlo', 'monospace'],
      },
      boxShadow: {
        'glow-amber': '0 0 24px -4px rgba(245, 158, 11, 0.45)',
        'glow-cyan': '0 0 24px -4px rgba(34, 211, 238, 0.45)',
        'glow-emerald': '0 0 24px -4px rgba(52, 211, 153, 0.45)',
      },
    },
  },
  plugins: [],
};
