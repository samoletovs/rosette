# Component Specifications

Detailed patterns for common UI components aligned with the design system.

## Buttons

### Variants
| Variant | Use Case | Style |
|---------|----------|-------|
| **Primary** | Main action (submit, save, create) | Filled accent, white text |
| **Secondary** | Alternative action | Outlined or ghost |
| **Tertiary/Ghost** | Low-priority action, inline links | Text-only, subtle hover |
| **Destructive** | Delete, remove, cancel | Red/error color |
| **Icon-only** | Toolbar actions | Square, icon centered |

### Sizes
```css
.btn-sm   { height: 32px; padding: 0 12px; font-size: var(--text-sm); }
.btn-md   { height: 40px; padding: 0 16px; font-size: var(--text-base); }
.btn-lg   { height: 48px; padding: 0 24px; font-size: var(--text-md); }
```

### States
- **Default**: Base style
- **Hover**: Slightly darker/lighter background, smooth transition (100ms)
- **Active/Pressed**: More pronounced darken/lighten
- **Focus**: 2px focus ring with 2px offset, accent color
- **Disabled**: 50% opacity, no pointer events, cursor: not-allowed
- **Loading**: Inline spinner, text preserved for width stability, disabled

### Rules
- One primary button per visible area
- Button text: verb-first ("Save changes" not "Changes save")
- Min width: 64px. Don't make buttons too narrow.
- Icon + text: icon on the left (leading side)

## Form Inputs

### Text Input
```
Label                        ← always visible, above input
┌──────────────────────────┐
│ Placeholder text          │ ← subtle color, disappears on focus
└──────────────────────────┘
Helper text                  ← optional, below input

On error:
Label                        ← turns error color
┌──────────────────────────┐ ← border turns error color
│ User's input              │
└──────────────────────────┘
Error message               ← error color, icon + text
```

### Input Sizing
```css
.input { 
  height: 40px; 
  padding: 0 12px;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  font-size: var(--text-base);
  transition: border-color var(--duration-fast) var(--ease-default);
}
.input:focus {
  border-color: var(--color-border-focus);
  outline: 2px solid var(--color-accent-subtle);
  outline-offset: -1px;
}
```

### Select / Dropdown
- Use native selects for simple lists (<10 items)
- Custom dropdowns for search, multi-select, or complex items
- Max dropdown height: 300px with scroll
- Highlight on hover and keyboard navigation

### Checkbox & Radio
- Size: 18-20px
- Custom styling matching the design system
- Clear focus indicators
- Label is clickable (wraps the input)

### Toggle / Switch
- Width: 44px, Height: 24px
- Clear on/off states (not just color — include position change)
- Animate the thumb position (duration-fast)
- Don't use for settings that require a submit action

## Cards

### Standard Card
```css
.card {
  background: var(--color-bg-elevated);
  border-radius: var(--radius-lg);
  padding: var(--space-5);
  box-shadow: var(--shadow-sm);
  transition: box-shadow var(--duration-fast) var(--ease-default);
}
.card:hover {
  box-shadow: var(--shadow-md); /* Only if card is clickable */
}
```

### Card Content Structure
1. **Media** (optional): Image or icon at top
2. **Header**: Title + optional metadata
3. **Body**: Description or content
4. **Footer** (optional): Actions or metadata

### Interactive Cards
- Entire card is clickable (common pattern)
- Hover: elevate shadow slightly
- Focus: visible focus ring on the card boundary
- Link inside card: make the card's click area the link

## Tables

### Simple Table
```css
.table {
  width: 100%;
  border-collapse: collapse;
}
.table th {
  text-align: left;
  font-weight: 600;
  font-size: var(--text-sm);
  color: var(--color-text-secondary);
  padding: var(--space-3) var(--space-4);
  border-bottom: 2px solid var(--color-border-strong);
}
.table td {
  padding: var(--space-3) var(--space-4);
  border-bottom: 1px solid var(--color-border);
}
.table tr:hover {
  background: var(--color-bg-secondary);
}
```

### Table Rules
- Freeze header row on scroll
- Right-align numeric columns
- Sortable columns: show sort indicator
- Row actions: show on hover or in last column
- Mobile: collapse to card layout or horizontal scroll

## Modals / Dialogs

### Sizes
- **Small** (400px): Confirmations, simple forms
- **Medium** (560px): Standard forms, detail views
- **Large** (720px): Complex forms, editors

### Structure
```
┌──────────────────────────────────┐
│ Title                       [✕] │ ← sticky header
├──────────────────────────────────┤
│                                  │
│ Content area (scrollable)        │
│                                  │
├──────────────────────────────────┤
│              [Cancel] [Confirm]  │ ← sticky footer
└──────────────────────────────────┘
```

### Rules
- Dim overlay: `rgba(0,0,0,0.4)` — click to dismiss (not for destructive)
- Focus trap: Tab cycles within the modal
- Escape key dismisses
- Entrance: fade overlay + scale content from 95% to 100%
- Exit: reverse (faster — `duration-fast`)

## Avatars

### Sizes
- **Extra small** (24px): Inline mentions, dense lists
- **Small** (32px): Comments, list items
- **Medium** (40px): Navigation, cards
- **Large** (64px): Profile headers, settings

### Fallback
When no image: show initials on colored background (use consistent color per user).

## Empty States

### Structure
```
        [Icon/Illustration]
        
        Heading (what goes here)
        Description (why it's empty,
        what to do next)
        
        [Primary Action Button]
```

- Center vertically and horizontally in the content area
- Icon or illustration should match the design system aesthetic
- Action button is optional but recommended
- Tone: helpful, not apologetic ("No projects yet" not "Sorry, nothing found")
