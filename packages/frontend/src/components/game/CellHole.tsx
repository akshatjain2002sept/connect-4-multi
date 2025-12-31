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
        // LOCKED hole colors - derived from board, desaturated
        // Radial gradient: lighter at top-left (30% 30%), darker at bottom-right
        // No green/teal/cyan. Reads as depth, not color.
        background: `
          radial-gradient(
            circle at 30% 30%,
            ${colors.hole.top} 0%,
            ${colors.hole.middle} 45%,
            ${colors.hole.bottom} 70%
          )
        `,
        boxShadow: shadows.hole,
      }}
      onClick={canInteract ? onClick : undefined}
      disabled={!canInteract}
    >
      {/* No rim overlay - hole gradient provides all depth */}

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
