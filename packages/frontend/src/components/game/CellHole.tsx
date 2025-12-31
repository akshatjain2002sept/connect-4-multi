import { colors, shadows } from '../../styles/gameTokens'
import { Chip } from './Chip'

interface CellHoleProps {
  value: '0' | '1' | '2'
  isWinning?: boolean
  isLastMove?: boolean
  isPreview?: boolean
  previewColor?: 'red' | 'yellow'
  canInteract?: boolean
  onClick?: () => void
}

export function CellHole({
  value,
  isWinning = false,
  isLastMove = false,
  isPreview = false,
  previewColor,
  canInteract = false,
  onClick,
}: CellHoleProps) {
  const hasChip = value !== '0'
  const chipColor = value === '1' ? 'red' : 'yellow'

  return (
    <button
      type="button"
      className={`
        relative aspect-square w-full rounded-full
        flex items-center justify-center
        transition-transform duration-150
        ${canInteract ? 'cursor-pointer hover:scale-105 active:scale-95' : 'cursor-default'}
      `}
      style={{
        // Layered cavity effect - navy blue derived from board, NOT black
        // Radial gradient: lighter at top-left, darker at bottom-right
        background: `
          radial-gradient(
            ellipse 120% 120% at 30% 25%,
            ${colors.hole.highlight} 0%,
            ${colors.hole.base} 40%,
            ${colors.hole.deep} 100%
          )
        `,
        // Soft inner shadow for depth, not harsh contrast
        boxShadow: shadows.hole,
      }}
      onClick={canInteract ? onClick : undefined}
      disabled={!canInteract}
    >
      {/* Faint reflected light rim at top edge - very subtle */}
      <div
        className="absolute inset-0 rounded-full pointer-events-none"
        style={{
          background: `
            linear-gradient(
              180deg,
              ${colors.hole.rim}15 0%,
              transparent 20%
            )
          `,
        }}
      />

      {/* Show preview chip on hover */}
      {isPreview && previewColor && !hasChip && (
        <div className="w-[85%] h-[85%]">
          <Chip color={previewColor} state="preview" />
        </div>
      )}

      {/* Actual chip */}
      {hasChip && (
        <div className="w-[85%] h-[85%]">
          <Chip
            color={chipColor}
            state={isWinning ? 'winning' : 'placed'}
            animate={isLastMove}
          />
        </div>
      )}
    </button>
  )
}
