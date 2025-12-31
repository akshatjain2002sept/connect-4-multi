import { ReactNode } from 'react'
import { colors, shadows } from '../../styles/gameTokens'

interface MatchLayoutProps {
  children: ReactNode
}

export function MatchLayout({ children }: MatchLayoutProps) {
  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center p-2 sm:p-4"
      style={{
        // Soft slate gradient - calm, breathable, modern
        // Slightly darker at bottom for subtle grounding
        background: `linear-gradient(180deg, ${colors.bg.pageLight} 0%, ${colors.bg.page} 100%)`,
      }}
    >
      {/* Gentle radial light centered behind board - very subtle */}
      <div
        className="fixed pointer-events-none"
        style={{
          width: '120vw',
          height: '120vh',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          // Very soft, low-opacity glow - board pops through color, not darkness
          background: `radial-gradient(ellipse 50% 40% at 50% 45%, rgba(255, 255, 255, 0.04) 0%, transparent 60%)`,
        }}
      />

      {/* Match container - integrates with background, not a floating card */}
      <div
        className="relative z-10 w-full flex flex-col"
        style={{
          maxWidth: 'min(95vw, 700px)',
          maxHeight: '90vh',
        }}
      >
        {/* Match panel - softer shadow, feels part of environment */}
        <div
          className="rounded-xl sm:rounded-2xl overflow-hidden flex flex-col"
          style={{
            background: colors.bg.card,
            boxShadow: shadows.card,
          }}
        >
          {children}
        </div>
      </div>
    </div>
  )
}
