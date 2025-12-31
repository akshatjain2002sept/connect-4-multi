import { ReactNode } from 'react'
import { colors, shadows, radii } from '../../styles/gameTokens'

interface BoardFrameProps {
  children: ReactNode
}

export function BoardFrame({ children }: BoardFrameProps) {
  return (
    <div className="relative">
      {/* Main board frame */}
      <div
        className="relative rounded-xl sm:rounded-2xl overflow-hidden"
        style={{
          // Outer bevel effect
          background: `
            linear-gradient(
              180deg,
              ${colors.board.accent} 0%,
              ${colors.board.primary} 5%,
              ${colors.board.secondary} 95%,
              ${colors.board.frameDark} 100%
            )
          `,
          boxShadow: shadows.board,
          padding: '3px',
        }}
      >
        {/* Inner face */}
        <div
          className="rounded-lg sm:rounded-xl p-2 sm:p-3"
          style={{
            background: `
              linear-gradient(
                180deg,
                ${colors.board.primary} 0%,
                ${colors.board.secondary} 100%
              )
            `,
            boxShadow: shadows.boardInset,
          }}
        >
          {children}
        </div>
      </div>

      {/* Subtle bottom foot/base - NOT protruding above */}
      <div
        className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-[90%] h-2 rounded-b-lg"
        style={{
          background: `linear-gradient(180deg, ${colors.board.frameDark} 0%, #0f172a 100%)`,
          boxShadow: '0 4px 8px rgba(0, 0, 0, 0.3)',
        }}
      />

      {/* Ground shadow */}
      <div
        className="absolute -bottom-3 left-1/2 -translate-x-1/2 w-[80%] h-4 opacity-30"
        style={{
          background: 'radial-gradient(ellipse at center, rgba(0,0,0,0.6) 0%, transparent 70%)',
          filter: 'blur(4px)',
        }}
      />
    </div>
  )
}
