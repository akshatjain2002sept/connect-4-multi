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
  // Background - Warm neutral (calm, inviting, like ambient light)
  // The board pops because it's colorful, not because everything else is dark
  bg: {
    page: '#4a5568',         // Soft neutral gray - main page background
    pageLight: '#5a6578',    // Slightly lighter for subtle gradient
    card: '#3d4552',         // Card background - subtle contrast
    cardLight: '#4a5568',    // Card header/footer areas
  },

  // Board (only saturated blue in UI)
  board: {
    primary: '#2563eb',      // Vibrant blue
    secondary: '#1d4ed8',    // Darker blue for depth
    accent: '#3b82f6',       // Lighter blue for highlights
    frame: '#1e40af',        // Frame edge
    frameDark: '#1e3a8a',    // Frame shadow
  },

  // Chips (only saturated red/yellow in UI)
  chip: {
    red: {
      primary: '#dc2626',    // Core red
      light: '#ef4444',      // Highlight
      dark: '#991b1b',       // Shadow
      rim: '#b91c1c',        // Edge ring
      glow: 'rgba(239, 68, 68, 0.4)',  // For active state
    },
    yellow: {
      primary: '#eab308',    // Core yellow
      light: '#facc15',      // Highlight
      dark: '#a16207',       // Shadow
      rim: '#ca8a04',        // Edge ring
      glow: 'rgba(250, 204, 21, 0.4)', // For active state
    },
  },

  // Holes - derived from board blue, NOT black or green
  // Should read as carved cavities - depth, not color
  // No teal/cyan/green bias - pure desaturated board blue
  hole: {
    base: '#1a3354',         // Dark navy (desaturated board blue)
    deep: '#122440',         // Deeper shadow - pure dark blue
    highlight: '#243d5c',    // Subtle top-left highlight
    rim: '#2d4a6a',          // Faint reflected light rim
  },

  // Neutral Text Hierarchy (NO SEMANTIC COLORS)
  text: {
    primary: '#ffffff',      // Brightest - active/important
    secondary: '#e2e8f0',    // Default readable text (slate-200)
    muted: '#94a3b8',        // De-emphasized text (slate-400)
    subtle: '#64748b',       // Very subtle/disabled (slate-500)
  },
} as const

// =============================================================================
// SHADOWS
// =============================================================================

export const shadows = {
  // Card/Panel shadows - softer for lighter background
  card: '0 10px 25px -5px rgba(0, 0, 0, 0.2), 0 4px 10px -5px rgba(0, 0, 0, 0.1)',
  cardHover: '0 15px 35px -5px rgba(0, 0, 0, 0.25)',

  // Board shadow - softer, less harsh
  board: '0 15px 30px rgba(0, 0, 0, 0.25), 0 5px 15px rgba(0, 0, 0, 0.15)',
  boardInset: 'inset 0 2px 4px rgba(255, 255, 255, 0.1), inset 0 -2px 4px rgba(0, 0, 0, 0.15)',

  // Hole shadows - soft depth, not harsh contrast
  hole: 'inset 0 3px 6px rgba(0, 0, 0, 0.3), inset 0 1px 2px rgba(0, 0, 0, 0.2)',
  holeRim: 'inset 0 -1px 1px rgba(255, 255, 255, 0.08)',

  // Chip shadows
  chipDrop: '0 2px 4px rgba(0, 0, 0, 0.25)',
  chipInset: 'inset 0 -3px 6px rgba(0, 0, 0, 0.2)',

  // Glow effects (using CHIP colors, not semantic colors)
  redGlow: '0 0 12px rgba(239, 68, 68, 0.5)',
  yellowGlow: '0 0 12px rgba(250, 204, 21, 0.5)',

  // Subtle active glow (lower opacity for understated effect)
  redGlowSubtle: '0 0 8px rgba(239, 68, 68, 0.3)',
  yellowGlowSubtle: '0 0 8px rgba(250, 204, 21, 0.3)',
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
