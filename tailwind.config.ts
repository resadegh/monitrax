import type { Config } from "tailwindcss";

const config: Config = {
    darkMode: ["class"],
    content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
  	extend: {
  		colors: {
  			// Monitrax Brand Colors
  			brand: {
  				primary: 'hsl(var(--color-brand-primary))',      // Deep Navy
  				secondary: 'hsl(var(--color-brand-secondary))',  // Emerald
  				accent: 'hsl(var(--color-brand-accent))',        // Amber
  			},
  			// Semantic Colors
  			success: 'hsl(var(--color-success))',
  			warning: 'hsl(var(--color-warning))',
  			error: 'hsl(var(--color-error))',
  			info: 'hsl(var(--color-info))',
  			// Base Theme
  			background: 'hsl(var(--background))',
  			foreground: 'hsl(var(--foreground))',
  			card: {
  				DEFAULT: 'hsl(var(--card))',
  				foreground: 'hsl(var(--card-foreground))'
  			},
  			popover: {
  				DEFAULT: 'hsl(var(--popover))',
  				foreground: 'hsl(var(--popover-foreground))'
  			},
  			primary: {
  				DEFAULT: 'hsl(var(--primary))',
  				foreground: 'hsl(var(--primary-foreground))'
  			},
  			secondary: {
  				DEFAULT: 'hsl(var(--secondary))',
  				foreground: 'hsl(var(--secondary-foreground))'
  			},
  			muted: {
  				DEFAULT: 'hsl(var(--muted))',
  				foreground: 'hsl(var(--muted-foreground))'
  			},
  			accent: {
  				DEFAULT: 'hsl(var(--accent))',
  				foreground: 'hsl(var(--accent-foreground))'
  			},
  			destructive: {
  				DEFAULT: 'hsl(var(--destructive))',
  				foreground: 'hsl(var(--destructive-foreground))'
  			},
  			border: 'hsl(var(--border))',
  			input: 'hsl(var(--input))',
  			ring: 'hsl(var(--ring))',
  			chart: {
  				'1': 'hsl(var(--chart-1))',
  				'2': 'hsl(var(--chart-2))',
  				'3': 'hsl(var(--chart-3))',
  				'4': 'hsl(var(--chart-4))',
  				'5': 'hsl(var(--chart-5))'
  			},
  			// Phase 48 — Public-website Deep Cosmos palette (PR 1, 2026-05-26).
  			// Scope: PUBLIC-website only. Internal app continues to use the
  			// canonical app tokens above. See PHASE_48_PUBLIC_WEBSITE_REDESIGN.md
  			// + app/globals.css cosmos block.
  			cosmos: {
  				bg: 'hsl(var(--cosmos-bg))',                         // #0A0A14
  				deeper: 'hsl(var(--cosmos-bg-deeper))',              // #08080F
  				surface: 'hsl(var(--cosmos-surface))',               // #16161E
  				elevated: 'hsl(var(--cosmos-surface-elevated))',     // #1E1E26
  				text: 'hsl(var(--cosmos-text))',                     // white
  				soft: 'hsl(var(--cosmos-text-soft))',                // white-60
  				muted: 'hsl(var(--cosmos-text-muted))',              // white-40
  				faint: 'hsl(var(--cosmos-text-faint))',              // white-30
  				action: 'hsl(var(--cosmos-action))',                 // emerald-500
  				'action-soft': 'hsl(var(--cosmos-action-soft))',     // emerald-400
  				// TRAIL stage hues on Cosmos (SSOT preserved)
  				track: 'hsl(var(--cosmos-track))',                   // sky
  				reduce: 'hsl(var(--cosmos-reduce))',                 // amber
  				anchor: 'hsl(var(--cosmos-anchor))',                 // indigo
  				invest: 'hsl(var(--cosmos-invest))',                 // emerald
  				live: 'hsl(var(--cosmos-live))',                     // violet
  			}
  		},
  		borderRadius: {
  			lg: 'var(--radius)',
  			md: 'calc(var(--radius) - 2px)',
  			sm: 'calc(var(--radius) - 4px)'
  		}
  	}
  },
  plugins: [require("tailwindcss-animate")],
};
export default config;
