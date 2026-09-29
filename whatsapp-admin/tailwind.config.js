/** @type {import('tailwindcss').Config} */
export default {
  darkMode: ["class"],
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Leeway Softech Theme Colors
        primary: {
          50: 'rgba(19, 76, 188, 0.05)',    // #134cbc0d
          100: 'rgba(19, 76, 188, 0.15)',  // #134cbc26
          500: '#134CBC',                 // Primary blue
          600: '#0F3A8C',                 // Darker blue (hover)
          700: '#0a2d6a',
          foreground: '#FFFFFF',
        },
        secondary: {
          50: 'rgba(1, 145, 67, 0.1)',     // #0191431a
          500: '#139C32',                  // Green accent
          600: '#0f7a25',
          foreground: '#FFFFFF',
        },
        leeway: {
          green: '#ABDBD1',               // Light green from social icons
          red: '#E31E25',                 // Red from their theme
          blue: {
            50: '#f0f7ff',
            100: '#e0f0ff',
            500: '#134CBC',
            600: '#0F3A8C',
            700: '#0a2d6a',
          },
          green: {
            50: '#f0fdf4',
            100: '#dcfce7',
            500: '#139C32',
          },
        },
        // Keep your existing colors but override with Leeway theme
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
        muted: {
          DEFAULT: 'hsl(var(--muted))',
          foreground: 'hsl(var(--muted-foreground))',
        },
        accent: {
          DEFAULT: 'hsl(var(--accent))',
          foreground: 'hsl(var(--accent-foreground))',
        },
        destructive: {
          DEFAULT: '#E31E25',             // Leeway's red
          foreground: 'hsl(var(--destructive-foreground))',
        },
        border: 'hsl(var(--border))',
        input: 'hsl(var(--input))',
        ring: '#134CBC',                  // Primary blue for focus rings
      },
      borderRadius: {
        lg: 'var(--radius)',
        md: 'calc(var(--radius) - 2px)',
        sm: 'calc(var(--radius) - 4px)',
        full: '9999px',
      },
      fontFamily: {
        sans: ['Poppins', 'Inter', 'sans-serif'], // Add Poppins as primary
      },
      boxShadow: {
        'leeway-sm': '0 4px 8px rgba(0, 0, 0, 0.1)',
        'leeway-md': '0 16px 24px 15px rgba(0, 0, 0, 0.05)',
        'leeway-lg': '0 15px 50px 0 rgba(19, 76, 188, 0.05)', // #134cbc0d
        'leeway-blue': '0 16px 24px 15px rgba(19, 76, 188, 0.1)',
        'leeway-green': '0 16px 24px 15px rgba(1, 145, 67, 0.1)',
      },
      keyframes: {
        'accordion-down': {
          from: { height: '0' },
          to: { height: 'var(--radix-accordion-content-height)' },
        },
        'accordion-up': {
          from: { height: 'var(--radix-accordion-content-height)' },
          to: { height: '0' },
        },
      },
      animation: {
        'accordion-down': 'accordion-down 0.2s ease-out',
        'accordion-up': 'accordion-up 0.2s ease-out',
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
}
