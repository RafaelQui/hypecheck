/**
 * Semantic design tokens for the mobile app.
 *
 * These tokens mirror the naming conventions used in web artifacts (index.css)
 * so that multi-artifact projects share a cohesive visual identity.
 *
 * Replace the placeholder values below with values that match the project's
 * brand. If a sibling web artifact exists, read its index.css and convert the
 * HSL values to hex so both artifacts use the same palette.
 *
 * To add dark mode, add a `dark` key with the same token names.
 * The useColors() hook will automatically pick it up.
 */

const colors = {
  light: {
    // Legacy aliases (kept for backward compatibility)
    text: '#17151A',
    tint: '#FF5A5F',

    // Core surfaces
    background: '#FFFCFA',
    foreground: '#17151A',

    // Cards / elevated surfaces
    card: '#FFFFFF',
    cardForeground: '#17151A',

    // Primary action color (buttons, links, active states)
    primary: '#FF5A5F',
    primaryForeground: '#ffffff',

    // Secondary / less-emphasis interactive surfaces
    secondary: '#FFF0EF',
    secondaryForeground: '#8F3337',

    // Muted / subdued elements (dividers, timestamps, placeholders)
    muted: '#F4F0EE',
    mutedForeground: '#837A7A',

    // Accent highlights (badges, selected items, focus rings)
    accent: '#FFF4DB',
    accentForeground: '#8A5A11',

    // Destructive actions (delete, error states)
    destructive: '#ef4444',
    destructiveForeground: '#ffffff',

    // Borders and input outlines
    border: '#EAE3E0',
    input: '#EAE3E0',
  },

  // Border radius (in px). Sync from the sibling web artifact's --radius
  // CSS variable. This value applies to cards, buttons, inputs, and modals.
  radius: 18,
};

export default colors;
