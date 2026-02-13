/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './app/**/*.{js,jsx}',
    './components/**/*.{js,jsx}',
  ],
  theme: {
    extend: {
      colors: {
        base: 'var(--bg-base)',
        surface: 'var(--bg-surface)',
        elevated: 'var(--bg-elevated)',
        highlight: 'var(--bg-highlight)',
        input: 'var(--bg-input)',
        primary: {
          DEFAULT: 'var(--primary)',
          strong: 'var(--primary-strong)',
          ghost: 'var(--primary-ghost)',
        },
        success: {
          DEFAULT: 'var(--success)',
          ghost: 'var(--success-ghost)',
        },
        warning: {
          DEFAULT: 'var(--warning)',
          ghost: 'var(--warning-ghost)',
        },
        critical: {
          DEFAULT: 'var(--critical)',
          ghost: 'var(--critical-ghost)',
        },
      },
      textColor: {
        primary: 'var(--text-primary)',
        secondary: 'var(--text-secondary)',
        muted: 'var(--text-muted)',
        disabled: 'var(--text-disabled)',
      },
      borderColor: {
        subtle: 'var(--border-subtle)',
        strong: 'var(--border-strong)',
      },
      boxShadow: {
        soft: 'var(--shadow-soft)',
        strong: 'var(--shadow-strong)',
        glow: 'var(--card-glow)',
      },
      borderRadius: {
        12: '12px',
        16: '16px',
      },
      spacing: {
        'sp-8': 'var(--space-8)',
        'sp-12': 'var(--space-12)',
        'sp-16': 'var(--space-16)',
        'sp-24': 'var(--space-24)',
      },
      fontSize: {
        title: 'var(--text-title)',
        kpi: 'var(--text-kpi)',
        label: 'var(--text-label)',
      },
    },
  },
  plugins: [],
}
