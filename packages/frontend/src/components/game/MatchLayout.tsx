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
        // LOCKED: Soft tabletop neutral, vertical gradient (top → bottom)
        // No vignette, no radial spotlight
        background: `linear-gradient(180deg, ${colors.bg.pageLight} 0%, ${colors.bg.page} 100%)`,
      }}
    >
      {/* NO radial spotlight - removed per color lock */}

      {/* Match container - integrates with background, not a floating card */}
      <div
        className="relative z-10 w-full flex flex-col"
        style={{
          maxWidth: 'min(95vw, 700px)',
          maxHeight: '90vh',
        }}
      >
        {/* Match panel - LOCKED card styling */}
        <div
          className="rounded-xl sm:rounded-2xl overflow-hidden flex flex-col"
          style={{
            background: colors.bg.card,
            border: `1px solid ${colors.bg.cardBorder}`,
            boxShadow: shadows.card,
          }}
        >
          {children}
        </div>
      </div>
    </div>
  )
}
