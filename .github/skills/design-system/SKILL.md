---
name: design-system
description: >-
  Comprehensive design system and UI guide for building clean, simple, and clear interfaces
  across all platforms — web, mobile, desktop, and notifications. Use this skill whenever the 
  user asks to design, style, theme, beautify, or improve the UI/UX of any application. Also 
  use when creating new components, pages, layouts, color schemes, typography, animations, 
  or visual design decisions. Applies to React, HTML/CSS, React Native, Swift/SwiftUI, Kotlin, 
  Electron, WPF, and any other platform. Covers design tokens, accessibility, responsive 
  layout, dark/light themes, component patterns, and cross-platform consistency. Use even when 
  the user doesn't explicitly say "design" — if they're building UI, styling elements, picking 
  colors, choosing fonts, laying out pages, or making anything user-facing, this skill applies.
---

# Design System

A cross-platform design system for building interfaces that are **clean, simple, clear, and 
intentional**. Inspired by the best of Apple HIG, Microsoft Fluent 2, and Google Material 3 — 
but refined into a unified philosophy that prioritizes clarity and human-centered craft.

## Core Philosophy

Three words guide every decision: **Clarity. Calm. Craft.**

- **Clarity** — Every element earns its place. If it doesn't help the user, remove it.
- **Calm** — Interfaces should feel quiet and confident, never anxious or busy.
- **Craft** — Subtle details (spacing, alignment, transitions) separate good from great.

This is not minimalism for its own sake. It's **purposeful reduction** — removing noise so 
content and actions shine. Think of it as the design equivalent of clean code: readable, 
maintainable, elegant.

## Design Principles

### 1. Content First
The UI should disappear in favor of content. Controls, chrome, and navigation exist to serve 
content — not to decorate the screen. Reduce visual layers. Let content breathe.

### 2. Progressive Disclosure
Show only what's needed at each moment. Advanced features exist but don't compete for 
attention. Use hierarchy and layering to reveal complexity when the user is ready.

### 3. Consistent Rhythm
Spacing, sizing, and timing follow a predictable system. Users shouldn't consciously notice 
the grid — they should just feel that "everything is in the right place."

### 4. Respectful Motion
Animation should orient, not entertain. Transitions explain spatial relationships. Loading 
states communicate progress. Nothing bounces unnecessarily.

### 5. Universal Access
Accessibility is not a feature, it's a foundation. Every design decision must work for 
all users — keyboard navigation, screen readers, color contrast, reduced motion.

## Design Tokens

Use design tokens (CSS custom properties, platform equivalents) as the single source of truth 
for all visual values. Never hardcode colors, spacing, or typography.

### Color System

The color system uses **semantic naming** — colors describe their purpose, not their hue.

```css
/* --- Light Theme --- */
--color-bg-primary:       #FAFAF9;     /* Main background — warm white */
--color-bg-secondary:     #F3F2F0;     /* Cards, sections — subtle warmth */
--color-bg-tertiary:      #EBEAE8;     /* Inset areas, code blocks */
--color-bg-elevated:      #FFFFFF;     /* Elevated surfaces, modals, popovers */

--color-text-primary:     #1A1A19;     /* Main text — near-black, not pure black */
--color-text-secondary:   #6B6A68;     /* Descriptions, captions */
--color-text-tertiary:    #9B9A98;     /* Placeholders, disabled text */
--color-text-inverse:     #FAFAF9;     /* Text on dark/accent backgrounds */

--color-accent:           #2563EB;     /* Primary action — confident blue */
--color-accent-hover:     #1D4ED8;     /* Hover state */
--color-accent-subtle:    #EFF6FF;     /* Accent-tinted backgrounds */

--color-success:          #16A34A;     /* Positive states */
--color-warning:          #D97706;     /* Attention needed */
--color-error:            #DC2626;     /* Errors, destructive actions */
--color-info:             #0EA5E9;     /* Informational */

--color-border:           #E5E4E2;     /* Default borders — barely visible */
--color-border-strong:    #D1D0CE;     /* Emphasized borders */
--color-border-focus:     #2563EB;     /* Focus rings — matches accent */

/* --- Dark Theme --- */
--color-bg-primary:       #141413;     /* Main background */
--color-bg-secondary:     #1E1E1D;     /* Cards, sections */
--color-bg-tertiary:      #282827;     /* Inset areas */
--color-bg-elevated:      #232322;     /* Elevated surfaces */

--color-text-primary:     #F0EFED;     /* Main text */
--color-text-secondary:   #A3A2A0;     /* Secondary text */
--color-text-tertiary:    #6B6A68;     /* Tertiary text */

--color-accent:           #60A5FA;     /* Lighter blue for dark backgrounds */
--color-accent-hover:     #93C5FD;
--color-accent-subtle:    #1E293B;

--color-border:           #2E2E2D;
--color-border-strong:    #3E3E3D;
```

**Rules:**
- Never use pure black (`#000000`) for text — it's too harsh. Use near-black.
- Never use pure white (`#FFFFFF`) for backgrounds — use warm whites with a hint of warmth.
- Accent color should be used sparingly — only for primary actions and focus states.
- Ensure all text passes WCAG AA contrast (4.5:1 for body, 3:1 for large text).

### Typography

Use a **two-font system**: one for headings, one for everything else.

**Recommended Pairings (choose one pair per project):**

| Context | Heading Font | Body Font | Character |
|---------|-------------|-----------|-----------|
| Professional/SaaS | **DM Sans** | **DM Sans** | Clean, geometric, modern |
| Editorial/Content | **Playfair Display** | **Source Sans 3** | Refined, readable |
| Technical/Dev | **JetBrains Mono** | **Inter** | Precise, monospaced headers |
| Warm/Friendly | **Nunito** | **Nunito** | Rounded, approachable |
| Premium/Luxury | **Cormorant Garamond** | **Lato** | Elegant, timeless |

**Type Scale (based on 1.250 — Major Third):**

```css
--text-xs:    0.64rem;    /* 10.24px — fine print */
--text-sm:    0.8rem;     /* 12.8px — captions, labels */
--text-base:  1rem;       /* 16px — body text */
--text-md:    1.25rem;    /* 20px — large body, lead text */
--text-lg:    1.563rem;   /* 25px — section titles */
--text-xl:    1.953rem;   /* 31.25px — page titles */
--text-2xl:   2.441rem;   /* 39px — hero headlines */
--text-3xl:   3.052rem;   /* 48.8px — display text */

--leading-tight:   1.25;
--leading-normal:  1.5;
--leading-relaxed: 1.75;

--tracking-tight:  -0.02em;
--tracking-normal:  0;
--tracking-wide:    0.05em;
```

**Rules:**
- Body text: 16px minimum on all platforms. 14px only for secondary/auxiliary text.
- Line height: 1.5 for body. 1.25 for headings.
- Max line width: 65–75 characters for readability.
- Font weight: prefer 400 (regular) and 600 (semi-bold). Avoid bold (700) except for emphasis.

### Spacing System

Use a **4px base grid** with an 8px rhythm as the primary spacing unit.

```css
--space-0:   0;
--space-1:   0.25rem;   /* 4px */
--space-2:   0.5rem;    /* 8px */
--space-3:   0.75rem;   /* 12px */
--space-4:   1rem;      /* 16px */
--space-5:   1.25rem;   /* 20px */
--space-6:   1.5rem;    /* 24px */
--space-8:   2rem;      /* 32px */
--space-10:  2.5rem;    /* 40px */
--space-12:  3rem;      /* 48px */
--space-16:  4rem;      /* 64px */
--space-20:  5rem;      /* 80px */
--space-24:  6rem;      /* 96px */
```

**Rules:**
- Padding inside elements: use `space-3` to `space-6`.
- Gap between related elements: `space-2` to `space-4`.
- Gap between sections: `space-12` to `space-20`.
- Generous whitespace > cramped content. When in doubt, add more space.

### Border Radius

```css
--radius-none: 0;
--radius-sm:   0.25rem;   /* 4px — subtle rounding */
--radius-md:   0.5rem;    /* 8px — buttons, inputs */
--radius-lg:   0.75rem;   /* 12px — cards */
--radius-xl:   1rem;      /* 16px — modals, panels */
--radius-2xl:  1.5rem;    /* 24px — large containers */
--radius-full: 9999px;    /* Pills, avatars */
```

Pick one radius level per project and use it consistently. Don't mix `radius-sm` and 
`radius-xl` on the same page.

### Shadows & Elevation

```css
--shadow-xs:    0 1px 2px rgba(0,0,0,0.04);
--shadow-sm:    0 1px 3px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.04);
--shadow-md:    0 4px 6px rgba(0,0,0,0.05), 0 2px 4px rgba(0,0,0,0.04);
--shadow-lg:    0 10px 15px rgba(0,0,0,0.06), 0 4px 6px rgba(0,0,0,0.04);
--shadow-xl:    0 20px 25px rgba(0,0,0,0.08), 0 8px 10px rgba(0,0,0,0.04);
```

**Rules:**
- Shadows should be subtle and warm-toned. No dark, hard shadows.
- Use elevation to create visual hierarchy, not decoration.
- Dark theme: reduce shadow opacity or replace with subtle border highlights.

### Motion & Animation

```css
--duration-instant:   0ms;
--duration-fast:      100ms;
--duration-normal:    200ms;
--duration-slow:      300ms;
--duration-slower:    500ms;

--ease-default:       cubic-bezier(0.25, 0.1, 0.25, 1);    /* Smooth decel */
--ease-in:            cubic-bezier(0.42, 0, 1, 1);          /* Accelerating */
--ease-out:           cubic-bezier(0, 0, 0.58, 1);          /* Decelerating */
--ease-in-out:        cubic-bezier(0.42, 0, 0.58, 1);       /* Symmetric */
--ease-spring:        cubic-bezier(0.34, 1.56, 0.64, 1);    /* Bouncy/spring */
```

**Rules:**
- Hover transitions: `duration-fast` (100ms).
- Page transitions: `duration-normal` to `duration-slow` (200-300ms).
- Entrance animations: `duration-slow` (300ms) with staggered delays.
- Always respect `prefers-reduced-motion: reduce` — disable non-essential animation.
- Prefer opacity + translate transforms. Avoid scaling unless intentional.

## Component Patterns

Read `references/components.md` for detailed component specifications. Key principles:

### Buttons
- **Primary**: Filled with accent color. One per visible area.
- **Secondary**: Outlined or ghost. For alternative actions.
- **Destructive**: Red/error color. Requires confirmation for permanent actions.
- Size: min 44x44px touch target (mobile), 36px height (desktop).
- States: default, hover, active, focus, disabled, loading.

### Cards
- Background: `bg-elevated` or `bg-secondary`.
- Padding: `space-5` to `space-6`.
- Border: subtle (`border`) or none with shadow (`shadow-sm`).
- Border-radius: `radius-lg`.
- Keep cards consistent in height within grids.

### Forms & Inputs
- Label above input, not inside (placeholder is not a label).
- Error messages below input in `color-error`.
- Focus ring: 2px solid `color-border-focus` with 2px offset.
- Group related fields. Single-column layout preferred.

### Navigation
- Keep navigation quiet — it should guide, not dominate.
- Active state: accent color or bold weight, not both.
- Mobile: bottom navigation or slide-out drawer.
- Desktop: sidebar or top bar, never both competing.

### Notifications & Toasts
- Position: top-right (desktop), top (mobile).
- Auto-dismiss: 5 seconds for info, persistent for errors.
- Include icon matching severity (success/warning/error/info).
- Support dismiss action.
- Never stack more than 3 visible notifications.

## Platform-Specific Guidelines

Read the relevant reference file for platform-specific guidance:

- `references/web.md` — Web applications (React, Vue, HTML/CSS, SPA, PWA)
- `references/mobile.md` — Mobile applications (React Native, iOS, Android)
- `references/desktop.md` — Desktop applications (Electron, WPF, macOS native)
- `references/notifications.md` — System notifications, emails, push, toasts

## Layout Patterns

### The 12-Column Grid
Use a 12-column grid for web. Common layouts:
- **Full-width content**: 12 cols
- **Content + sidebar**: 8+4 or 9+3
- **Centered content**: 6-8 cols centered
- **Bento grid**: Mixed size cards in a grid (contemporary, Apple-inspired)

### Responsive Breakpoints
```css
--bp-sm:   640px;    /* Phone landscape */
--bp-md:   768px;    /* Tablet portrait */
--bp-lg:   1024px;   /* Tablet landscape / small desktop */
--bp-xl:   1280px;   /* Desktop */
--bp-2xl:  1536px;   /* Large desktop */
```

### Container Widths
```css
--container-sm:   640px;
--container-md:   768px;
--container-lg:   1024px;
--container-xl:   1200px;   /* Default max-width for content */
```

## Dark Mode Strategy

- Light mode is the default. Dark mode should feel intentional, not inverted.
- Don't just invert colors — dark backgrounds need warmer text (not pure white).
- Reduce shadow usage in dark mode, use subtle border highlights instead.
- Accent colors often need to be lighter/less saturated in dark mode.
- Test both themes with actual content, not just components.

## Accessibility Checklist

Before shipping any UI:
- [ ] All interactive elements reachable via keyboard
- [ ] Focus indicators visible and clear
- [ ] Color contrast meets WCAG AA (4.5:1 body, 3:1 large text)
- [ ] No information conveyed by color alone
- [ ] Images have alt text
- [ ] Forms have labels (not just placeholders)
- [ ] `prefers-reduced-motion` respected
- [ ] Touch targets minimum 44x44px on mobile
- [ ] Screen reader testing done on key flows

## Design Review Checklist

Before considering any UI "done":
- [ ] Does every element earn its place? Remove anything decorative-only.
- [ ] Is spacing consistent and following the grid?
- [ ] Does it look right at all breakpoints?
- [ ] Does dark mode work properly?
- [ ] Is the visual hierarchy clear? Can you tell what's most important in 2 seconds?
- [ ] Are interactive elements obvious? Can you tell what's clickable?
- [ ] Does it feel calm and confident, or busy and anxious?

## Anti-Patterns (What to Avoid)

- **Purple gradients on white** — The "AI startup" look. Overdone.
- **Too many border radiuses** — Pick one level and stick to it.
- **Gratuitous animations** — If it doesn't aid comprehension, skip it.
- **Gray text on gray background** — Contrast matters. Test it.
- **Icon salad** — Don't use 15 different icon styles. Pick one icon set.
- **Feature creep in nav** — Not everything deserves a top-level nav item.
- **Inconsistent spacing** — The fastest way to make UI look amateur.
- **Stock photography** — If you must use images, invest in quality or use illustrations.

## Resources & Inspiration

### Design Systems to Study
- **Apple HIG**: https://developer.apple.com/design/human-interface-guidelines/
- **Microsoft Fluent 2**: https://fluent2.microsoft.design/
- **Google Material 3**: https://m3.material.io/
- **Vercel/Geist**: https://vercel.com/geist/introduction
- **Radix Themes**: https://www.radix-ui.com/themes
- **shadcn/ui**: https://ui.shadcn.com/

### Current Trends (2025-2026)
- **Bento grids** — Multi-size card layouts (Apple keynote style)
- **Spatial design** — Depth, layers, and glassmorphism done tastefully
- **Micro-interactions** — Subtle response to user actions
- **Variable fonts** — Single font file, infinite weight/width control
- **Container queries** — Component-level responsive design
- **View transitions** — Browser-native page transitions
- **AI-adaptive UI** — Interfaces that restructure based on user behavior
- **Liquid Glass** — Apple's 2025 design language with translucent, layered surfaces
- **M3 Expressive** — Google's emotion-driven UX with vibrant colors and shapes

### Tools
- **Figma** — Design and prototyping
- **Storybook** — Component development and documentation
- **Chromatic** — Visual regression testing
- **Lighthouse** — Performance and accessibility auditing
