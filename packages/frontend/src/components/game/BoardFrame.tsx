import { ReactNode } from 'react'
import { colors, shadows, radii } from '../../styles/gameTokens'

interface BoardFrameProps {
  children: ReactNode
}

export function BoardFrame({ children }: BoardFrameProps) {
  return (
    <div className="relative">
      {/* Main board frame - LOCKED board colors */}
      <div
        className="relative rounded-xl sm:rounded-2xl overflow-hidden"
        style={{
          // Frame edge with gradient to face
          background: `
            linear-gradient(
              180deg,
              ${colors.board.primary} 0%,
              ${colors.board.secondary} 100%
            )
          `,
          boxShadow: shadows.board,
          padding: '3px',
        }}
      >
        {/* Inner face - LOCKED: primary (top) to secondary (bottom) */}
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
          }}
        >
          {children}
        </div>
      </div>

      {/* Subtle bottom foot/base */}
      <div
        className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-[90%] h-2 rounded-b-lg"
        style={{
          background: `linear-gradient(180deg, ${colors.board.frame} 0%, #1a2744 100%)`,
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
