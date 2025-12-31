import { colors, shadows } from '../../styles/gameTokens'

interface ChipProps {
  color: 'red' | 'yellow'
  state?: 'placed' | 'preview' | 'winning'
  animate?: boolean
}

export function Chip({ color, state = 'placed', animate = false }: ChipProps) {
  const chipColors = colors.chip[color]
  const isPreview = state === 'preview'
  const isWinning = state === 'winning'

  return (
    <div
      className={`
        relative w-full h-full rounded-full
        ${animate ? 'animate-chip-drop' : ''}
        ${isWinning ? 'animate-winner-pulse' : ''}
        ${isPreview ? 'opacity-50' : 'opacity-100'}
      `}
      style={{
        // Multi-layer gradient for 3D disc effect
        background: `
          radial-gradient(
            ellipse 80% 50% at 50% 100%,
            ${chipColors.dark} 0%,
            transparent 50%
          ),
          radial-gradient(
            ellipse 100% 100% at 50% 50%,
            ${chipColors.light} 0%,
            ${chipColors.primary} 40%,
            ${chipColors.dark} 100%
          )
        `,
        boxShadow: `
          ${shadows.chipDrop},
          ${shadows.chipInset},
          inset 0 1px 2px rgba(255, 255, 255, 0.3)
        `,
        // Crisp edge ring
        border: `2px solid ${chipColors.rim}`,
      }}
    >
      {/* Top-left specular highlight */}
      <div
        className="absolute rounded-full"
        style={{
          top: '10%',
          left: '15%',
          width: '40%',
          height: '30%',
          background: `
            radial-gradient(
              ellipse at 50% 50%,
              rgba(255, 255, 255, 0.6) 0%,
              rgba(255, 255, 255, 0.2) 40%,
              transparent 70%
            )
          `,
          transform: 'rotate(-25deg)',
        }}
      />

      {/* Secondary smaller highlight */}
      <div
        className="absolute rounded-full"
        style={{
          top: '18%',
          left: '22%',
          width: '20%',
          height: '15%',
          background: `
            radial-gradient(
              ellipse at center,
              rgba(255, 255, 255, 0.8) 0%,
              transparent 60%
            )
          `,
        }}
      />

      {/* Winner glow ring */}
      {isWinning && (
        <div
          className="absolute inset-0 rounded-full animate-pulse"
          style={{
            boxShadow: color === 'red' ? shadows.redGlow : shadows.yellowGlow,
          }}
        />
      )}
    </div>
  )
}
