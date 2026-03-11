# Synozur Brand Directions

> **Purpose**: This document is the single source of truth for restoring any visual theme state of the Synozur app. Each direction contains the complete `:root` and `.dark` CSS variable blocks that replace lines 53–149 of `client/src/index.css`. An agent with zero conversation context can open this file, pick a direction, and apply it exactly.

> **Brand reference**: `attached_assets/Synozur_MPF_Messaging_and_Positioning_Framework...docx`

## Brand Facts

| Attribute | Value |
|---|---|
| **Name origin** | Greek for "North Star" — navigation, illumination, guidance |
| **Taglines** | "The transformation company" / "Find your North Star" / "Make the desirable achievable" |
| **Brand colors** | Purple + magenta — inspired by the founder's car navigation dashboard at night; evocative of illumination in the night sky |
| **Primary purple** | `#810FFB` / `hsl(268.98 96.72% 52.16%)` / `oklch(53% 0.28 295)` |
| **Secondary magenta** | `#E60CB3` / `hsl(314.04 90.08% 47.45%)` / `oklch(50% 0.28 330)` |
| **Font** | Avenir Next LT Pro (all weights installed in `/client/public/fonts/`) |
| **Personality** | Empathetic, precise, strategic, premium, human-centered, Fortune 500 expertise with boutique agility |
| **Target audience** | CxO and BDM (business buyer), premium B2B SaaS |

---

## How to Apply a Direction

1. Open `client/src/index.css`
2. Replace the `:root { ... }` block (currently lines 53–100) with the direction's **Light mode `:root`** block
3. Replace the `.dark { ... }` block (currently lines 102–149) with the direction's **Dark mode `.dark`** block
4. If the direction includes extra CSS utilities (Direction 3 only), append them after the existing `.synozur-gradient` block
5. Save and reload

---

## DIRECTION 0 — Current State (Baseline)

*"As-built" snapshot captured March 2026. Restore this to undo all brand changes.*

### Known issues in this state (not bugs to fix, just documented):
- Dark mode `--primary` silently switches from Synozur purple (`#810FFB`) to generic sky blue (`hsl(203.77 87.6% 52.55%)` ≈ `#1AB1EE`) — brand-breaking regression in dark mode
- Sidebar `--sidebar-primary` and `--sidebar-accent-foreground` use that same sky blue in BOTH light and dark modes — off-brand active states everywhere
- Dark mode `--background` is pure `#000000` — violates the brand's "illumination in the night sky" metaphor
- `.synozur-gradient` exists but in dark mode it uses the sky blue primary, so the gradient loses the Synozur identity

### Light mode `:root` (exact current values):
```css
:root {
  --background: hsl(0 0% 100%);
  --foreground: hsl(210 25% 7.8431%);
  --card: hsl(180 6.6667% 97.0588%);
  --card-foreground: hsl(210 25% 7.8431%);
  --popover: hsl(0 0% 100%);
  --popover-foreground: hsl(210 25% 7.8431%);
  --primary: hsl(268.98, 96.72%, 52.16%);
  --primary-foreground: hsl(0 0% 100%);
  --secondary: hsl(314.04, 90.08%, 47.45%);
  --secondary-foreground: hsl(0 0% 100%);
  --muted: hsl(240 1.9608% 90%);
  --muted-foreground: hsl(210 25% 7.8431%);
  --accent: hsl(211.58, 51.35%, 92.75%);
  --accent-foreground: hsl(269.16, 80.45%, 26.08%);
  --destructive: hsl(356.3033 90.5579% 54.3137%);
  --destructive-foreground: hsl(0 0% 100%);
  --border: hsl(201.4286 30.4348% 90.9804%);
  --input: hsl(200 23.0769% 97.4510%);
  --ring: hsl(268.98, 96.72%, 52.16%);
  --chart-1: hsl(268.98, 96.72%, 52.16%);
  --chart-2: hsl(314.04, 90.08%, 47.45%);
  --chart-3: hsl(269.16, 80.45%, 26.08%);
  --chart-4: hsl(147.1429 78.5047% 41.9608%);
  --chart-5: hsl(341.4894 75.2000% 50.9804%);
  --sidebar: hsl(180 6.6667% 97.0588%);
  --sidebar-foreground: hsl(210 25% 7.8431%);
  --sidebar-primary: hsl(203.8863 88.2845% 53.1373%);        /* OFF-BRAND: sky blue */
  --sidebar-primary-foreground: hsl(0 0% 100%);
  --sidebar-accent: hsl(211.5789 51.3514% 92.7451%);
  --sidebar-accent-foreground: hsl(203.8863 88.2845% 53.1373%); /* OFF-BRAND: sky blue */
  --sidebar-border: hsl(205.0000 25.0000% 90.5882%);
  --sidebar-ring: hsl(202.8169 89.1213% 53.1373%);            /* OFF-BRAND: sky blue */
  --font-sans: 'Avenir Next LT Pro', sans-serif;
  --font-serif: 'Avenir Next LT Pro', sans-serif;
  --font-mono: 'Avenir Next LT Pro', monospace;
  --radius: 1.3rem;
  --shadow-2xs: 0px 2px 0px 0px hsl(202.8169 89.1213% 53.1373% / 0.00);
  --shadow-xs: 0px 2px 0px 0px hsl(202.8169 89.1213% 53.1373% / 0.00);
  --shadow-sm: 0px 2px 0px 0px hsl(202.8169 89.1213% 53.1373% / 0.00), 0px 1px 2px -1px hsl(202.8169 89.1213% 53.1373% / 0.00);
  --shadow: 0px 2px 0px 0px hsl(202.8169 89.1213% 53.1373% / 0.00), 0px 1px 2px -1px hsl(202.8169 89.1213% 53.1373% / 0.00);
  --shadow-md: 0px 2px 0px 0px hsl(202.8169 89.1213% 53.1373% / 0.00), 0px 2px 4px -1px hsl(202.8169 89.1213% 53.1373% / 0.00);
  --shadow-lg: 0px 2px 0px 0px hsl(202.8169 89.1213% 53.1373% / 0.00), 0px 4px 6px -1px hsl(202.8169 89.1213% 53.1373% / 0.00);
  --shadow-xl: 0px 2px 0px 0px hsl(202.8169 89.1213% 53.1373% / 0.00), 0px 8px 10px -1px hsl(202.8169 89.1213% 53.1373% / 0.00);
  --shadow-2xl: 0px 2px 0px 0px hsl(202.8169 89.1213% 53.1373% / 0.00);
  --tracking-normal: 0em;
  --spacing: 0.25rem;
}
```

### Dark mode `.dark` (exact current values):
```css
.dark {
  --background: hsl(0 0% 0%);                                 /* pure black — off-brand */
  --foreground: hsl(200 6.6667% 91.1765%);
  --card: hsl(228 9.8039% 10%);
  --card-foreground: hsl(0 0% 85.0980%);
  --popover: hsl(0 0% 0%);
  --popover-foreground: hsl(200 6.6667% 91.1765%);
  --primary: hsl(203.7736 87.6033% 52.5490%);                 /* OFF-BRAND: sky blue, not Synozur purple */
  --primary-foreground: hsl(0 0% 100%);
  --secondary: hsl(195.0000 15.3846% 94.9020%);               /* very light grey — washed out */
  --secondary-foreground: hsl(210 25% 7.8431%);
  --muted: hsl(0 0% 9.4118%);
  --muted-foreground: hsl(210 3.3898% 46.2745%);
  --accent: hsl(205.7143 70% 7.8431%);
  --accent-foreground: hsl(203.7736 87.6033% 52.5490%);       /* OFF-BRAND: sky blue */
  --destructive: hsl(356.3033 90.5579% 54.3137%);
  --destructive-foreground: hsl(0 0% 100%);
  --border: hsl(210 5.2632% 14.9020%);
  --input: hsl(207.6923 27.6596% 18.4314%);
  --ring: hsl(202.8169 89.1213% 53.1373%);                    /* OFF-BRAND: sky blue */
  --chart-1: hsl(203.8863 88.2845% 53.1373%);                 /* OFF-BRAND: sky blue */
  --chart-2: hsl(159.7826 100% 36.0784%);
  --chart-3: hsl(42.0290 92.8251% 56.2745%);
  --chart-4: hsl(147.1429 78.5047% 41.9608%);
  --chart-5: hsl(341.4894 75.2000% 50.9804%);
  --sidebar: hsl(228 9.8039% 10%);
  --sidebar-foreground: hsl(0 0% 85.0980%);
  --sidebar-primary: hsl(202.8169 89.1213% 53.1373%);         /* OFF-BRAND: sky blue */
  --sidebar-primary-foreground: hsl(0 0% 100%);
  --sidebar-accent: hsl(205.7143 70% 7.8431%);
  --sidebar-accent-foreground: hsl(203.7736 87.6033% 52.5490%); /* OFF-BRAND: sky blue */
  --sidebar-border: hsl(205.7143 15.7895% 26.0784%);
  --sidebar-ring: hsl(202.8169 89.1213% 53.1373%);            /* OFF-BRAND: sky blue */
  --font-sans: 'Avenir Next LT Pro', sans-serif;
  --font-serif: 'Avenir Next LT Pro', sans-serif;
  --font-mono: 'Avenir Next LT Pro', monospace;
  --radius: 1.3rem;
  --shadow: 0px 2px 0px 0px hsl(202.8169 89.1213% 53.1373% / 0.00), 0px 1px 2px -1px hsl(202.8169 89.1213% 53.1373% / 0.00);
  --spacing: 0.25rem;
  --shadow-lg: 0px 2px 0px 0px hsl(202.8169 89.1213% 53.1373% / 0.00), 0px 4px 6px -1px hsl(202.8169 89.1213% 53.1373% / 0.00);
  --shadow-md: 0px 2px 0px 0px hsl(202.8169 89.1213% 53.1373% / 0.00), 0px 2px 4px -1px hsl(202.8169 89.1213% 53.1373% / 0.00);
  --shadow-sm: 0px 2px 0px 0px hsl(202.8169 89.1213% 53.1373% / 0.00), 0px 1px 2px -1px hsl(202.8169 89.1213% 53.1373% / 0.00);
  --shadow-xl: 0px 2px 0px 0px hsl(202.8169 89.1213% 53.1373% / 0.00), 0px 8px 10px -1px hsl(202.8169 89.1213% 53.1373% / 0.00);
  --shadow-xs: 0px 2px 0px 0px hsl(202.8169 89.1213% 53.1373% / 0.00);
  --shadow-2xl: 0px 2px 0px 0px hsl(202.8169 89.1213% 53.1373% / 0.00);
  --shadow-2xs: 0px 2px 0px 0px hsl(202.8169 89.1213% 53.1373% / 0.00);
  --tracking-normal: 0em;
}
```

---

## DIRECTION 1 — "Night Sky"

*The brand metaphor made literal: illumination in the night sky. Deep dark surfaces, brand gradient as the light source. This becomes the default experience — the app feels like a premium observatory dashboard.*

### What changes vs current state:
- Default mode shifts to dark-first. Light mode becomes the optional variant.
- Light mode retains Synozur purple/magenta correctly but with warmer off-white surfaces (not pure white)
- Dark mode background changes from pure black to a deep purple-tinted near-black (`#0D0A14`)
- Dark mode primary/secondary FIXED to use Synozur purple and magenta (not sky blue)
- Sidebar uses brand gradient for active states; sidebar background is its own deep charcoal
- Cards in dark mode are slightly lighter than background, with a faint purple-tinted border
- All chart-1 and ring colors fixed to Synozur purple in dark mode

### Palette (OKLCH reference):
| Role | OKLCH | Hex | HSL |
|---|---|---|---|
| Purple (primary) | `oklch(53% 0.28 295)` | `#810FFB` | `hsl(268.98 96.72% 52.16%)` |
| Magenta (secondary) | `oklch(50% 0.28 330)` | `#E60CB3` | `hsl(314.04 90.08% 47.45%)` |
| Deep background | `oklch(12% 0.015 295)` | `#0D0A14` | `hsl(270 30% 6%)` |
| Card surface | `oklch(16% 0.018 295)` | `#141020` | `hsl(270 25% 9%)` |
| Sidebar | `oklch(14% 0.02 295)` | `#100C1A` | `hsl(270 35% 5%)` |
| Muted text | `oklch(55% 0.005 295)` | `#808088` | `hsl(270 8% 55%)` |
| Border | `oklch(20% 0.025 295)` | `#1D1630` | `hsl(270 20% 15%)` |
| Off-white light bg | `oklch(98.5% 0.004 295)` | `#FAF9FD` | `hsl(270 20% 98.5%)` |

### Light mode `:root`:
```css
:root {
  --background: hsl(270 20% 98.5%);
  --foreground: hsl(270 25% 8%);
  --card: hsl(270 15% 97%);
  --card-foreground: hsl(270 25% 8%);
  --popover: hsl(270 20% 98.5%);
  --popover-foreground: hsl(270 25% 8%);
  --primary: hsl(268.98 96.72% 52.16%);
  --primary-foreground: hsl(0 0% 100%);
  --secondary: hsl(314.04 90.08% 47.45%);
  --secondary-foreground: hsl(0 0% 100%);
  --muted: hsl(270 8% 91%);
  --muted-foreground: hsl(270 10% 40%);
  --accent: hsl(270 40% 94%);
  --accent-foreground: hsl(270 80% 26%);
  --destructive: hsl(356.3 90.56% 54.31%);
  --destructive-foreground: hsl(0 0% 100%);
  --border: hsl(270 20% 88%);
  --input: hsl(270 15% 96%);
  --ring: hsl(268.98 96.72% 52.16%);
  --chart-1: hsl(268.98 96.72% 52.16%);
  --chart-2: hsl(314.04 90.08% 47.45%);
  --chart-3: hsl(269.16 80.45% 26.08%);
  --chart-4: hsl(147.14 78.5% 41.96%);
  --chart-5: hsl(341.49 75.2% 50.98%);
  --sidebar: hsl(270 18% 96%);
  --sidebar-foreground: hsl(270 25% 8%);
  --sidebar-primary: hsl(268.98 96.72% 52.16%);
  --sidebar-primary-foreground: hsl(0 0% 100%);
  --sidebar-accent: hsl(270 40% 92%);
  --sidebar-accent-foreground: hsl(268.98 96.72% 52.16%);
  --sidebar-border: hsl(270 20% 88%);
  --sidebar-ring: hsl(268.98 96.72% 52.16%);
  --font-sans: 'Avenir Next LT Pro', sans-serif;
  --font-serif: 'Avenir Next LT Pro', sans-serif;
  --font-mono: 'Avenir Next LT Pro', monospace;
  --radius: 1.3rem;
  --shadow-2xs: 0px 2px 4px 0px hsl(269 97% 52% / 0.06);
  --shadow-xs: 0px 2px 4px 0px hsl(269 97% 52% / 0.08);
  --shadow-sm: 0px 2px 4px 0px hsl(269 97% 52% / 0.06), 0px 1px 2px -1px hsl(269 97% 52% / 0.04);
  --shadow: 0px 4px 8px 0px hsl(269 97% 52% / 0.08), 0px 1px 2px -1px hsl(269 97% 52% / 0.04);
  --shadow-md: 0px 4px 12px 0px hsl(269 97% 52% / 0.10), 0px 2px 4px -1px hsl(269 97% 52% / 0.06);
  --shadow-lg: 0px 8px 20px 0px hsl(269 97% 52% / 0.12), 0px 4px 6px -1px hsl(269 97% 52% / 0.06);
  --shadow-xl: 0px 12px 30px 0px hsl(269 97% 52% / 0.14), 0px 8px 10px -1px hsl(269 97% 52% / 0.08);
  --shadow-2xl: 0px 20px 40px 0px hsl(269 97% 52% / 0.18);
  --tracking-normal: 0em;
  --spacing: 0.25rem;
}
```

### Dark mode `.dark`:
```css
.dark {
  --background: hsl(270 30% 6%);
  --foreground: hsl(270 10% 90%);
  --card: hsl(270 25% 9%);
  --card-foreground: hsl(270 10% 88%);
  --popover: hsl(270 30% 6%);
  --popover-foreground: hsl(270 10% 90%);
  --primary: hsl(268.98 96.72% 62%);
  --primary-foreground: hsl(0 0% 100%);
  --secondary: hsl(314.04 90.08% 60%);
  --secondary-foreground: hsl(0 0% 100%);
  --muted: hsl(270 15% 14%);
  --muted-foreground: hsl(270 8% 55%);
  --accent: hsl(270 30% 14%);
  --accent-foreground: hsl(268.98 96.72% 72%);
  --destructive: hsl(356.3 90.56% 60%);
  --destructive-foreground: hsl(0 0% 100%);
  --border: hsl(270 20% 15%);
  --input: hsl(270 20% 12%);
  --ring: hsl(268.98 96.72% 62%);
  --chart-1: hsl(268.98 96.72% 65%);
  --chart-2: hsl(314.04 90.08% 60%);
  --chart-3: hsl(269.16 80.45% 72%);
  --chart-4: hsl(147.14 78.5% 55%);
  --chart-5: hsl(341.49 75.2% 65%);
  --sidebar: hsl(270 35% 5%);
  --sidebar-foreground: hsl(270 10% 80%);
  --sidebar-primary: hsl(268.98 96.72% 62%);
  --sidebar-primary-foreground: hsl(0 0% 100%);
  --sidebar-accent: hsl(270 30% 11%);
  --sidebar-accent-foreground: hsl(268.98 96.72% 72%);
  --sidebar-border: hsl(270 20% 12%);
  --sidebar-ring: hsl(268.98 96.72% 62%);
  --font-sans: 'Avenir Next LT Pro', sans-serif;
  --font-serif: 'Avenir Next LT Pro', sans-serif;
  --font-mono: 'Avenir Next LT Pro', monospace;
  --radius: 1.3rem;
  --shadow: 0px 4px 8px 0px hsl(269 97% 10% / 0.40), 0px 1px 2px -1px hsl(269 97% 10% / 0.20);
  --shadow-sm: 0px 2px 4px 0px hsl(269 97% 10% / 0.30), 0px 1px 2px -1px hsl(269 97% 10% / 0.15);
  --shadow-md: 0px 4px 12px 0px hsl(269 97% 10% / 0.50), 0px 2px 4px -1px hsl(269 97% 10% / 0.25);
  --shadow-lg: 0px 8px 20px 0px hsl(269 97% 10% / 0.60), 0px 4px 6px -1px hsl(269 97% 10% / 0.30);
  --shadow-xl: 0px 12px 30px 0px hsl(269 97% 10% / 0.70), 0px 8px 10px -1px hsl(269 97% 10% / 0.35);
  --shadow-2xl: 0px 20px 40px 0px hsl(269 97% 10% / 0.80);
  --shadow-xs: 0px 1px 2px 0px hsl(269 97% 10% / 0.20);
  --shadow-2xs: 0px 1px 2px 0px hsl(269 97% 10% / 0.15);
  --tracking-normal: 0em;
  --spacing: 0.25rem;
}
```

---

## DIRECTION 2 — "Navigator's Chart"

*Clean professional precision with the brand as the single accent. Purple is the only accent color — used deliberately, never diluted. Feels like premium SaaS (Linear, Notion, Stripe).*

### What changes vs current state:
- Light mode surfaces go from generic teal-tinged grays to pure neutral off-white with a barely perceptible warm tone
- Sidebar active states fixed from sky blue → Synozur purple in both modes
- Dark mode primary fixed from sky blue → Synozur purple
- Dark mode background: near-black with a very subtle warm neutral tone (not purple-tinted)
- The gradient appears only in the logo lockup and `.synozur-gradient` utility — not as a component accent
- Secondary color in dark mode changed to a useful dark magenta (not the current washed-out light grey)
- All ring/focus colors aligned to Synozur purple

### Palette (OKLCH reference):
| Role | OKLCH | Hex | HSL |
|---|---|---|---|
| Purple (primary light) | `oklch(53% 0.28 295)` | `#810FFB` | `hsl(268.98 96.72% 52.16%)` |
| Purple (primary dark) | `oklch(65% 0.26 295)` | `#9B3FFD` | `hsl(268.98 90% 65%)` |
| Magenta (secondary) | `oklch(50% 0.28 330)` | `#E60CB3` | `hsl(314.04 90.08% 47.45%)` |
| Light background | `oklch(99% 0.002 270)` | `#FDFCFF` | `hsl(270 15% 99%)` |
| Light card | `oklch(98% 0.003 270)` | `#F9F8FC` | `hsl(270 12% 97.5%)` |
| Dark background | `oklch(10% 0.005 270)` | `#0F0F12` | `hsl(270 5% 6.5%)` |
| Dark card | `oklch(13% 0.006 270)` | `#141417` | `hsl(270 5% 9%)` |

### Light mode `:root`:
```css
:root {
  --background: hsl(270 15% 99%);
  --foreground: hsl(270 20% 8%);
  --card: hsl(270 12% 97.5%);
  --card-foreground: hsl(270 20% 8%);
  --popover: hsl(270 15% 99%);
  --popover-foreground: hsl(270 20% 8%);
  --primary: hsl(268.98 96.72% 52.16%);
  --primary-foreground: hsl(0 0% 100%);
  --secondary: hsl(314.04 90.08% 47.45%);
  --secondary-foreground: hsl(0 0% 100%);
  --muted: hsl(270 5% 92%);
  --muted-foreground: hsl(270 5% 42%);
  --accent: hsl(268.98 60% 95%);
  --accent-foreground: hsl(268.98 80% 28%);
  --destructive: hsl(356.3 90.56% 54.31%);
  --destructive-foreground: hsl(0 0% 100%);
  --border: hsl(270 8% 90%);
  --input: hsl(270 8% 96%);
  --ring: hsl(268.98 96.72% 52.16%);
  --chart-1: hsl(268.98 96.72% 52.16%);
  --chart-2: hsl(314.04 90.08% 47.45%);
  --chart-3: hsl(269.16 80.45% 26.08%);
  --chart-4: hsl(147.14 78.5% 41.96%);
  --chart-5: hsl(341.49 75.2% 50.98%);
  --sidebar: hsl(270 10% 98%);
  --sidebar-foreground: hsl(270 20% 8%);
  --sidebar-primary: hsl(268.98 96.72% 52.16%);
  --sidebar-primary-foreground: hsl(0 0% 100%);
  --sidebar-accent: hsl(268.98 60% 95%);
  --sidebar-accent-foreground: hsl(268.98 96.72% 52.16%);
  --sidebar-border: hsl(270 8% 90%);
  --sidebar-ring: hsl(268.98 96.72% 52.16%);
  --font-sans: 'Avenir Next LT Pro', sans-serif;
  --font-serif: 'Avenir Next LT Pro', sans-serif;
  --font-mono: 'Avenir Next LT Pro', monospace;
  --radius: 1.3rem;
  --shadow-2xs: 0px 1px 2px 0px hsl(270 10% 20% / 0.05);
  --shadow-xs: 0px 1px 3px 0px hsl(270 10% 20% / 0.07);
  --shadow-sm: 0px 2px 4px 0px hsl(270 10% 20% / 0.06), 0px 1px 2px -1px hsl(270 10% 20% / 0.04);
  --shadow: 0px 2px 6px 0px hsl(270 10% 20% / 0.08), 0px 1px 2px -1px hsl(270 10% 20% / 0.04);
  --shadow-md: 0px 4px 10px 0px hsl(270 10% 20% / 0.08), 0px 2px 4px -1px hsl(270 10% 20% / 0.05);
  --shadow-lg: 0px 8px 16px 0px hsl(270 10% 20% / 0.08), 0px 4px 6px -1px hsl(270 10% 20% / 0.05);
  --shadow-xl: 0px 12px 24px 0px hsl(270 10% 20% / 0.09), 0px 8px 10px -1px hsl(270 10% 20% / 0.05);
  --shadow-2xl: 0px 20px 36px 0px hsl(270 10% 20% / 0.10);
  --tracking-normal: 0em;
  --spacing: 0.25rem;
}
```

### Dark mode `.dark`:
```css
.dark {
  --background: hsl(270 5% 6.5%);
  --foreground: hsl(270 5% 90%);
  --card: hsl(270 5% 9%);
  --card-foreground: hsl(270 5% 86%);
  --popover: hsl(270 5% 6.5%);
  --popover-foreground: hsl(270 5% 90%);
  --primary: hsl(268.98 90% 65%);
  --primary-foreground: hsl(0 0% 100%);
  --secondary: hsl(314.04 80% 62%);
  --secondary-foreground: hsl(0 0% 100%);
  --muted: hsl(270 4% 13%);
  --muted-foreground: hsl(270 4% 52%);
  --accent: hsl(268.98 30% 13%);
  --accent-foreground: hsl(268.98 90% 70%);
  --destructive: hsl(356.3 80% 58%);
  --destructive-foreground: hsl(0 0% 100%);
  --border: hsl(270 5% 16%);
  --input: hsl(270 5% 12%);
  --ring: hsl(268.98 90% 65%);
  --chart-1: hsl(268.98 90% 65%);
  --chart-2: hsl(314.04 80% 62%);
  --chart-3: hsl(269.16 70% 70%);
  --chart-4: hsl(147.14 65% 52%);
  --chart-5: hsl(341.49 70% 62%);
  --sidebar: hsl(270 5% 5%);
  --sidebar-foreground: hsl(270 5% 82%);
  --sidebar-primary: hsl(268.98 90% 65%);
  --sidebar-primary-foreground: hsl(0 0% 100%);
  --sidebar-accent: hsl(268.98 30% 13%);
  --sidebar-accent-foreground: hsl(268.98 90% 70%);
  --sidebar-border: hsl(270 5% 14%);
  --sidebar-ring: hsl(268.98 90% 65%);
  --font-sans: 'Avenir Next LT Pro', sans-serif;
  --font-serif: 'Avenir Next LT Pro', sans-serif;
  --font-mono: 'Avenir Next LT Pro', monospace;
  --radius: 1.3rem;
  --shadow: 0px 2px 6px 0px hsl(270 10% 2% / 0.35), 0px 1px 2px -1px hsl(270 10% 2% / 0.20);
  --shadow-sm: 0px 1px 3px 0px hsl(270 10% 2% / 0.25), 0px 1px 2px -1px hsl(270 10% 2% / 0.12);
  --shadow-md: 0px 4px 10px 0px hsl(270 10% 2% / 0.40), 0px 2px 4px -1px hsl(270 10% 2% / 0.20);
  --shadow-lg: 0px 8px 18px 0px hsl(270 10% 2% / 0.50), 0px 4px 6px -1px hsl(270 10% 2% / 0.25);
  --shadow-xl: 0px 12px 28px 0px hsl(270 10% 2% / 0.55), 0px 8px 10px -1px hsl(270 10% 2% / 0.28);
  --shadow-2xl: 0px 20px 40px 0px hsl(270 10% 2% / 0.60);
  --shadow-xs: 0px 1px 2px 0px hsl(270 10% 2% / 0.18);
  --shadow-2xs: 0px 1px 2px 0px hsl(270 10% 2% / 0.12);
  --tracking-normal: 0em;
  --spacing: 0.25rem;
}
```

---

## DIRECTION 3 — "Aurora"

*The gradient as a living presence — not just a utility class but an active design element in borders, section headers, and active states. More energetic and marketing-forward.*

### What changes vs current state:
- Light background has the most perceptible purple-lavender cast of the three directions
- Sidebar active item has a 2px gradient left-border treatment (implemented via a custom CSS class, not a variable change — see extra CSS below)
- A new CSS variable `--brand-gradient` is introduced for consistent use across components
- Card selected/active state gets a gradient border using `border-image`
- Dark mode primary fixed to Synozur purple; secondary fixed to magenta
- Dark background slightly warmer and more saturated than Direction 2 — a deep indigo-purple

### Palette (OKLCH reference):
| Role | OKLCH | Hex | HSL |
|---|---|---|---|
| Purple (primary light) | `oklch(53% 0.28 295)` | `#810FFB` | `hsl(268.98 96.72% 52.16%)` |
| Magenta (secondary) | `oklch(50% 0.28 330)` | `#E60CB3` | `hsl(314.04 90.08% 47.45%)` |
| Light background | `oklch(97.5% 0.006 290)` | `#F7F5FD` | `hsl(268 30% 97%)` |
| Light card | `oklch(96% 0.007 290)` | `#F2EFFA` | `hsl(268 25% 95.5%)` |
| Dark background | `oklch(11% 0.012 290)` | `#110E1B` | `hsl(268 20% 7%)` |
| Dark card | `oklch(15% 0.014 290)` | `#171328` | `hsl(268 20% 10%)` |

### Light mode `:root`:
```css
:root {
  --background: hsl(268 30% 97%);
  --foreground: hsl(268 25% 8%);
  --card: hsl(268 25% 95.5%);
  --card-foreground: hsl(268 25% 8%);
  --popover: hsl(268 30% 97%);
  --popover-foreground: hsl(268 25% 8%);
  --primary: hsl(268.98 96.72% 52.16%);
  --primary-foreground: hsl(0 0% 100%);
  --secondary: hsl(314.04 90.08% 47.45%);
  --secondary-foreground: hsl(0 0% 100%);
  --muted: hsl(268 15% 89%);
  --muted-foreground: hsl(268 8% 38%);
  --accent: hsl(268 50% 92%);
  --accent-foreground: hsl(268 80% 25%);
  --destructive: hsl(356.3 90.56% 54.31%);
  --destructive-foreground: hsl(0 0% 100%);
  --border: hsl(268 18% 86%);
  --input: hsl(268 18% 94%);
  --ring: hsl(268.98 96.72% 52.16%);
  --chart-1: hsl(268.98 96.72% 52.16%);
  --chart-2: hsl(314.04 90.08% 47.45%);
  --chart-3: hsl(269.16 80.45% 26.08%);
  --chart-4: hsl(147.14 78.5% 41.96%);
  --chart-5: hsl(341.49 75.2% 50.98%);
  --sidebar: hsl(268 25% 95%);
  --sidebar-foreground: hsl(268 25% 8%);
  --sidebar-primary: hsl(268.98 96.72% 52.16%);
  --sidebar-primary-foreground: hsl(0 0% 100%);
  --sidebar-accent: hsl(268 50% 91%);
  --sidebar-accent-foreground: hsl(268.98 96.72% 45%);
  --sidebar-border: hsl(268 18% 86%);
  --sidebar-ring: hsl(268.98 96.72% 52.16%);
  --font-sans: 'Avenir Next LT Pro', sans-serif;
  --font-serif: 'Avenir Next LT Pro', sans-serif;
  --font-mono: 'Avenir Next LT Pro', monospace;
  --radius: 1.3rem;
  --shadow-2xs: 0px 1px 3px 0px hsl(268 50% 30% / 0.06);
  --shadow-xs: 0px 2px 4px 0px hsl(268 50% 30% / 0.08);
  --shadow-sm: 0px 2px 6px 0px hsl(268 50% 30% / 0.08), 0px 1px 2px -1px hsl(268 50% 30% / 0.05);
  --shadow: 0px 4px 8px 0px hsl(268 50% 30% / 0.10), 0px 1px 2px -1px hsl(268 50% 30% / 0.05);
  --shadow-md: 0px 4px 12px 0px hsl(268 50% 30% / 0.12), 0px 2px 4px -1px hsl(268 50% 30% / 0.06);
  --shadow-lg: 0px 8px 20px 0px hsl(268 50% 30% / 0.14), 0px 4px 6px -1px hsl(268 50% 30% / 0.06);
  --shadow-xl: 0px 12px 28px 0px hsl(268 50% 30% / 0.15), 0px 8px 10px -1px hsl(268 50% 30% / 0.08);
  --shadow-2xl: 0px 20px 40px 0px hsl(268 50% 30% / 0.18);
  --tracking-normal: 0em;
  --spacing: 0.25rem;
}
```

### Dark mode `.dark`:
```css
.dark {
  --background: hsl(268 20% 7%);
  --foreground: hsl(268 8% 88%);
  --card: hsl(268 20% 10%);
  --card-foreground: hsl(268 8% 85%);
  --popover: hsl(268 20% 7%);
  --popover-foreground: hsl(268 8% 88%);
  --primary: hsl(268.98 92% 64%);
  --primary-foreground: hsl(0 0% 100%);
  --secondary: hsl(314.04 85% 61%);
  --secondary-foreground: hsl(0 0% 100%);
  --muted: hsl(268 15% 15%);
  --muted-foreground: hsl(268 6% 53%);
  --accent: hsl(268 35% 16%);
  --accent-foreground: hsl(268.98 92% 70%);
  --destructive: hsl(356.3 85% 60%);
  --destructive-foreground: hsl(0 0% 100%);
  --border: hsl(268 18% 17%);
  --input: hsl(268 18% 13%);
  --ring: hsl(268.98 92% 64%);
  --chart-1: hsl(268.98 92% 64%);
  --chart-2: hsl(314.04 85% 61%);
  --chart-3: hsl(269.16 75% 72%);
  --chart-4: hsl(147.14 68% 54%);
  --chart-5: hsl(341.49 72% 63%);
  --sidebar: hsl(268 25% 6%);
  --sidebar-foreground: hsl(268 8% 80%);
  --sidebar-primary: hsl(268.98 92% 64%);
  --sidebar-primary-foreground: hsl(0 0% 100%);
  --sidebar-accent: hsl(268 35% 14%);
  --sidebar-accent-foreground: hsl(268.98 92% 72%);
  --sidebar-border: hsl(268 18% 14%);
  --sidebar-ring: hsl(268.98 92% 64%);
  --font-sans: 'Avenir Next LT Pro', sans-serif;
  --font-serif: 'Avenir Next LT Pro', sans-serif;
  --font-mono: 'Avenir Next LT Pro', monospace;
  --radius: 1.3rem;
  --shadow: 0px 4px 8px 0px hsl(268 30% 2% / 0.45), 0px 1px 2px -1px hsl(268 30% 2% / 0.22);
  --shadow-sm: 0px 2px 4px 0px hsl(268 30% 2% / 0.32), 0px 1px 2px -1px hsl(268 30% 2% / 0.15);
  --shadow-md: 0px 4px 12px 0px hsl(268 30% 2% / 0.50), 0px 2px 4px -1px hsl(268 30% 2% / 0.24);
  --shadow-lg: 0px 8px 20px 0px hsl(268 30% 2% / 0.60), 0px 4px 6px -1px hsl(268 30% 2% / 0.28);
  --shadow-xl: 0px 12px 30px 0px hsl(268 30% 2% / 0.65), 0px 8px 10px -1px hsl(268 30% 2% / 0.30);
  --shadow-2xl: 0px 20px 40px 0px hsl(268 30% 2% / 0.70);
  --shadow-xs: 0px 1px 2px 0px hsl(268 30% 2% / 0.20);
  --shadow-2xs: 0px 1px 2px 0px hsl(268 30% 2% / 0.14);
  --tracking-normal: 0em;
  --spacing: 0.25rem;
}
```

### Direction 3 extra: gradient accent utility additions

Append these after the existing `.synozur-gradient` block in `client/src/index.css`:

```css
/* Direction 3 only: gradient border for active sidebar items */
.sidebar-item-active-gradient {
  position: relative;
}
.sidebar-item-active-gradient::before {
  content: '';
  position: absolute;
  left: 0;
  top: 0;
  bottom: 0;
  width: 3px;
  background: linear-gradient(180deg, var(--primary), var(--secondary));
  border-radius: 0 2px 2px 0;
}

/* Direction 3 only: gradient top bar for page header */
.page-header-gradient-bar {
  border-top: 2px solid transparent;
  border-image: linear-gradient(90deg, var(--primary), var(--secondary)) 1;
}
```
