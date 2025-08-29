
import type {Config} from 'tailwindcss';

export default {
  darkMode: ['class'],
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    container: {
      center: true,
      padding: '2rem',
      screens: {
        '2xl': '1400px',
      },
    },
    extend: {
      fontFamily: {
        body: ['var(--font-inter)', 'sans-serif'],
        headline: ['var(--font-space-grotesk)', 'sans-serif'],
        code: ['var(--font-source-code-pro)', 'monospace'],
      },
      colors: {
        background: 'hsl(var(--background))',
        foreground: 'hsl(var(--foreground))',
        card: {
          DEFAULT: 'hsl(var(--card))',
          foreground: 'hsl(var(--card-foreground))',
        },
        popover: {
          DEFAULT: 'hsl(var(--popover))',
          foreground: 'hsl(var(--popover-foreground))',
        },
        primary: {
          DEFAULT: 'hsl(var(--primary))',
          foreground: 'hsl(var(--primary-foreground))',
        },
        secondary: {
          DEFAULT: 'hsl(var(--secondary))',
          foreground: 'hsl(var(--secondary-foreground))',
        },
        muted: {
          DEFAULT: 'hsl(var(--muted))',
          foreground: 'hsl(var(--muted-foreground))',
        },
        accent: {
          DEFAULT: 'hsl(var(--accent))',
          foreground: 'hsl(var(--accent-foreground))',
        },
        destructive: {
          DEFAULT: 'hsl(var(--destructive))',
          foreground: 'hsl(var(--destructive-foreground))',
        },
        border: 'hsl(var(--border))',
        input: 'hsl(var(--input))',
        ring: 'hsl(var(--ring))',
        chart: {
          '1': 'hsl(var(--chart-1))',
          '2': 'hsl(var(--chart-2))',
          '3': 'hsl(var(--chart-3))',
          '4': 'hsl(var(--chart-4))',
          '5': 'hsl(var(--chart-5))',
        },
      },
      borderRadius: {
        lg: '1rem',
        md: 'calc(1rem - 2px)',
        sm: 'calc(1rem - 4px)',
      },
      keyframes: {
        'accordion-down': {
          from: {
            height: '0',
          },
          to: {
            height: 'var(--radix-accordion-content-height)',
          },
        },
        'accordion-up': {
          from: {
            height: 'var(--radix-accordion-content-height)',
          },
          to: {
            height: '0',
          },
        },
        // Radix UI Navigation Menu animations
        'enterFromRight': { from: { opacity: '0', transform: 'translateX(200px)' }, to: { opacity: '1', transform: 'translateX(0)' } },
        'enterFromLeft': { from: { opacity: '0', transform: 'translateX(-200px)' }, to: { opacity: '1', transform: 'translateX(0)' } },
        'exitToRight': { from: { opacity: '1', transform: 'translateX(0)' }, to: { opacity: '0', transform: 'translateX(200px)' } },
        'exitToLeft': { from: { opacity: '1', transform: 'translateX(0)' }, to: { opacity: '0', transform: 'translateX(-200px)' } },
        'fadeIn': { from: { opacity: '0' }, to: { opacity: '1' } },
        'fadeOut': { from: { opacity: '1' }, to: { opacity: '0' } },
        'scaleIn': { from: { opacity: '0', transform: 'rotateX(-10deg) scale(0.9)' }, to: { opacity: '1', transform: 'rotateX(0deg) scale(1)' } },
        'scaleOut': { from: { opacity: '1', transform: 'rotateX(0deg) scale(1)' }, to: { opacity: '0', transform: 'rotateX(-10deg) scale(0.95)' } },
      },
      animation: {
        'accordion-down': 'accordion-down 0.2s ease-out',
        'accordion-up': 'accordion-up 0.2s ease-out',
        // Radix UI Navigation Menu animations
        'enterFromRight': 'enterFromRight 0.2s ease-out',
        'enterFromLeft': 'enterFromLeft 0.2s ease-out',
        'exitToRight': 'exitToRight 0.2s ease-in',
        'exitToLeft': 'exitToLeft 0.2s ease-in',
        'fadeIn': 'fadeIn 0.2s ease-out',
        'fadeOut': 'fadeOut 0.2s ease-in',
        'scaleIn': 'scaleIn 0.2s ease-out',
        'scaleOut': 'scaleOut 0.2s ease-in',
      },
    },
  },
  plugins: [require('tailwindcss-animate')],
} satisfies Config;
