import { Game } from '../lib/api'

interface ClaimWinButtonProps {
  game: Game
  myUserId: string
  onClaim: () => void
  loading?: boolean
}

export function ClaimWinButton({ game, myUserId, onClaim, loading }: ClaimWinButtonProps) {
  const isPlayer1 = myUserId === game.player1?.firebaseUid
  const opponentLastSeen = isPlayer1 ? game.player2LastSeen : game.player1LastSeen

  if (!opponentLastSeen) return null

  const timeSince = Date.now() - new Date(opponentLastSeen).getTime()
  if (timeSince < 30000) return null

  return (
    <button
      onClick={onClaim}
      disabled={loading}
      className={`
        bg-gradient-to-r from-yellow-400 to-yellow-500 px-6 py-3 rounded-xl font-bold text-white
        shadow-lg shadow-yellow-500/30 hover:shadow-xl hover:shadow-yellow-500/40
        hover:from-yellow-300 hover:to-yellow-400 transition-all duration-200
        animate-pulse-glow hover:animate-wiggle
        disabled:opacity-50 disabled:cursor-not-allowed
        flex items-center gap-2
      `}
    >
      <svg
        className="w-5 h-5"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
        />
      </svg>
      {loading ? 'Claiming...' : 'Opponent Disconnected - Claim Win'}
    </button>
  )
}
