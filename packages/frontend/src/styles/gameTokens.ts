/**
 * Design Tokens for Connect 4 Match UI
 * Premium, gamey aesthetic inspired by Chess.com
 *
 * COLOR DISCIPLINE:
 * - Only 3 saturated colors allowed: board blue, chip red, chip yellow
 * - All UI text/chrome must be neutral grayscale
 * - NO semantic colors (green for success, etc.)
 *
 * MOOD: Soft Slate
 * - Calm, breathable, modern
 * - Background recedes; board pops through color, not darkness
 * - Inviting for extended play sessions
 */

// =============================================================================
// COLORS
// =============================================================================

export const colors = {
  // ═══════════════════════════════════════════════════════════════════════════
  // HARD COLOR LOCK - Do not tune by eye. Use exact values only.
  // RULE: If any element introduces a new hue (green, teal, purple), it is WRONG.
  // Palette = slate neutrals + board blue + red/yellow chips ONLY.
  // ═══════════════════════════════════════════════════════════════════════════

  // Background - Soft tabletop neutral (NOT black, NOT blue/inky)
  // Feels like ambient room light, lets board pop without drama
  bg: {
    page: '#5F6876',         // Soft slate - main (gradient end)
    pageLight: '#6B7482',    // Slightly lighter (gradient start)
    card: '#3F4654',         // Card background
    cardBorder: 'rgba(255,255,255,0.06)',  // Subtle separation only
  },

  // Board - Most saturated object in UI (LOCKED)
  board: {
    primary: '#3F6FE8',      // Face top
    secondary: '#2F5FD8',    // Face bottom
    frame: '#2A54C8',        // Frame edge
  },

  // Chips - LOCKED (shading only, no hue shift)
  // Shadows → multiply with black, Highlights → add white, NEVER add green
  chip: {
    red: {
      primary: '#E23B34',    // Core red (LOCKED)
      light: '#F25A54',      // Highlight (white added)
      dark: '#B22E28',       // Shadow (black multiplied)
      rim: '#C93530',        // Edge ring
      glow: 'rgba(226, 59, 52, 0.4)',
    },
    yellow: {
      primary: '#F2C21A',    // Core yellow (LOCKED)
      light: '#F5D04A',      // Highlight (white added)
      dark: '#C29B15',       // Shadow (black multiplied)
      rim: '#D9AD17',        // Edge ring
      glow: 'rgba(242, 194, 26, 0.4)',
    },
  },

  // Holes - Derived from board, but DESATURATED (LOCKED)
  // Reads as depth, NOT color. No green/teal/cyan. Never pure black.
  hole: {
    top: '#2B3F5A',          // Inner top (lighter)
    middle: '#24364D',       // Inner middle
    bottom: '#1E2C40',       // Inner bottom (darker)
  },

  // Text - Neutral light grays only (NO accent colors)
  text: {
    primary: '#F1F3F6',      // Active player name
    secondary: '#C2C8D2',    // Inactive player name
    muted: '#9AA3B2',        // ELO / subtle info
  },
} as const

// =============================================================================
// SHADOWS
// =============================================================================

export const shadows = {
  // Card shadow (LOCKED)
  card: '0 18px 40px rgba(0, 0, 0, 0.25)',

  // Board shadow
  board: '0 15px 30px rgba(0, 0, 0, 0.25), 0 5px 15px rgba(0, 0, 0, 0.15)',

  // Hole shadows - soft depth
  hole: 'inset 0 3px 6px rgba(0, 0, 0, 0.3), inset 0 1px 2px rgba(0, 0, 0, 0.2)',

  // Chip shadows
  chipDrop: '0 2px 4px rgba(0, 0, 0, 0.25)',
  chipInset: 'inset 0 -3px 6px rgba(0, 0, 0, 0.2)',

  // Glow effects (using LOCKED chip colors)
  redGlow: '0 0 12px rgba(226, 59, 52, 0.5)',
  yellowGlow: '0 0 12px rgba(242, 194, 26, 0.5)',
  redGlowSubtle: '0 0 8px rgba(226, 59, 52, 0.3)',
  yellowGlowSubtle: '0 0 8px rgba(242, 194, 26, 0.3)',
} as const

// =============================================================================
// SPACING
// =============================================================================

export const spacing = {
  // Gap between header and board
  headerBoardGap: '12px',

  // Board padding
  boardPadding: {
    sm: '8px',
    md: '12px',
    lg: '16px',
  },

  // Cell gap
  cellGap: {
    sm: '4px',
    md: '6px',
    lg: '8px',
  },

  // Chip sizing (percentage of cell)
  chipSize: '85%',
} as const

// =============================================================================
// RADII
// =============================================================================

export const radii = {
  card: '16px',
  board: '12px',
  boardInner: '8px',
  cell: '50%',
  chip: '50%',
  button: '8px',
  badge: '6px',
} as const

// =============================================================================
// ANIMATIONS
// =============================================================================

export const animations = {
  // Chip drop timing
  dropDuration: '0.25s',
  dropEasing: 'cubic-bezier(0.4, 0, 0.2, 1)',

  // Hover transitions
  hoverDuration: '0.15s',

  // Glow pulse
  glowDuration: '1.5s',
} as const

// =============================================================================
// BREAKPOINTS (for reference)
// =============================================================================

export const breakpoints = {
  sm: '640px',
  md: '768px',
  lg: '1024px',
  xl: '1280px',
} as const

// =============================================================================
// LAYOUT
// =============================================================================

export const layout = {
  // Max width for the match card - larger for screen dominance
  maxWidth: '700px',

  // Board dimensions
  boardCols: 7,
  boardRows: 6,

  // Cell sizes - viewport-aware for screen dominance
  // Board should occupy ~65-70vh on desktop
  cellSize: {
    sm: '44px',      // Mobile fallback
    md: '56px',      // Tablet
    lg: '72px',      // Desktop - larger for dominance
  },
} as const
