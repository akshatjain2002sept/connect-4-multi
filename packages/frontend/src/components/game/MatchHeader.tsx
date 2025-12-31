import { colors, shadows } from '../../styles/gameTokens'

interface Player {
  username: string
  rating?: number
}

interface MatchHeaderProps {
  player1: Player | null
  player2: Player | null
  currentTurn: 1 | 2
  myPlayerNumber: 1 | 2 | null
  gameStatus: 'ACTIVE' | 'COMPLETED' | 'ABANDONED' | 'WAITING'
}

export function MatchHeader({
  player1,
  player2,
  currentTurn,
  myPlayerNumber,
  gameStatus,
}: MatchHeaderProps) {
  const isActive = gameStatus === 'ACTIVE'
  const isPlayer1Turn = currentTurn === 1
  const isPlayer2Turn = currentTurn === 2

  return (
    <div
      className="flex items-center justify-between px-3 sm:px-4 py-2.5 sm:py-3 rounded-t-xl"
      style={{
        background: `linear-gradient(180deg, ${colors.bg.cardLight} 0%, ${colors.bg.card} 100%)`,
        // No divider line - use spacing and opacity for separation
      }}
    >
      {/* Player 1 (Red) */}
      <PlayerBadge
        player={player1}
        color="red"
        isActive={isActive && isPlayer1Turn}
        isMe={myPlayerNumber === 1}
        side="left"
      />

      {/* Center - minimal VS */}
      <div className="flex flex-col items-center px-2">
        <span
          className="text-[10px] sm:text-xs font-medium tracking-wider"
          style={{ color: colors.text.subtle }}
        >
          VS
        </span>
      </div>

      {/* Player 2 (Yellow) */}
      <PlayerBadge
        player={player2}
        color="yellow"
        isActive={isActive && isPlayer2Turn}
        isMe={myPlayerNumber === 2}
        side="right"
      />
    </div>
  )
}

interface PlayerBadgeProps {
  player: { username: string; rating?: number } | null
  color: 'red' | 'yellow'
  isActive: boolean
  isMe: boolean
  side: 'left' | 'right'
}

function PlayerBadge({ player, color, isActive, isMe, side }: PlayerBadgeProps) {
  const chipColors = colors.chip[color]
  const isLeft = side === 'left'

  // Use chip color for active glow, NOT semantic green
  const activeGlow = color === 'red' ? shadows.redGlowSubtle : shadows.yellowGlowSubtle

  return (
    <div
      className={`flex items-center gap-2 sm:gap-2.5 min-w-0 ${isLeft ? 'flex-row' : 'flex-row-reverse'}`}
    >
      {/* Avatar dot with turn indicator using CHIP color glow */}
      <div className="relative flex-shrink-0">
        <div
          className={`w-6 h-6 sm:w-7 sm:h-7 rounded-full transition-shadow duration-200`}
          style={{
            background: `linear-gradient(135deg, ${chipColors.light} 0%, ${chipColors.primary} 50%, ${chipColors.dark} 100%)`,
            boxShadow: isActive
              ? `0 0 0 2px ${colors.bg.card}, ${activeGlow}`
              : 'none',
            border: `2px solid ${isActive ? chipColors.light : chipColors.rim}`,
          }}
        />
        {/* Subtle ping animation using chip color */}
        {isActive && (
          <div
            className="absolute inset-0 rounded-full animate-ping"
            style={{
              background: chipColors.glow,
              opacity: 0.4,
            }}
          />
        )}
      </div>

      {/* Player info - NO underlines, structure via spacing and brightness */}
      <div className={`flex flex-col min-w-0 ${isLeft ? 'items-start' : 'items-end'}`}>
        <div className="flex items-center gap-1.5">
          {/* Scoreboard-style player name: clean, confident, readable */}
          <span
            className={`text-sm sm:text-base truncate max-w-[80px] sm:max-w-[120px] transition-all duration-200 tracking-tight ${
              isActive ? 'font-medium' : 'font-normal'
            }`}
            style={{
              color: isActive ? colors.text.primary : colors.text.muted,
              letterSpacing: '-0.01em',
            }}
          >
            {player?.username || (color === 'red' ? 'Player 1' : 'Player 2')}
          </span>
          {isMe && (
            <span
              className="text-[10px] px-1.5 py-0.5 rounded font-medium"
              style={{
                background: `${chipColors.primary}15`,
                color: colors.text.muted,
              }}
            >
              You
            </span>
          )}
        </div>

        {/* Rating - subdued, secondary to name */}
        {player?.rating && (
          <span
            className="text-[10px] sm:text-xs mt-0.5 tracking-tight"
            style={{ color: colors.text.subtle, letterSpacing: '0.02em' }}
          >
            {player.rating}
          </span>
        )}
      </div>
    </div>
  )
}
