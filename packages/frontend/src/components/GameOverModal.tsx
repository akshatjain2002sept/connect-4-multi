import { Game, User } from '../lib/api'
import { GameResult } from '@connect4/shared'

interface GameOverModalProps {
  game: Game
  myPlayerNumber: 1 | 2 | null
  onRematch: () => void
  onBackToLobby: () => void
  rematchStatus: 'none' | 'requested' | 'pending' | 'loading'
}

export function GameOverModal({
  game,
  myPlayerNumber,
  onRematch,
  onBackToLobby,
  rematchStatus,
}: GameOverModalProps) {
  const getResultText = (): { title: string; subtitle: string; color: string } => {
    if (!game.result) {
      return { title: 'Game Over', subtitle: '', color: 'text-gray-600' }
    }

    const myResult = getMyResult(game.result, myPlayerNumber)

    switch (myResult) {
      case 'win':
        return {
          title: 'Victory!',
          subtitle: game.endedReason === 'ABANDONED' ? 'Opponent abandoned' : 'You connected four!',
          color: 'text-green-500',
        }
      case 'loss':
        return {
          title: 'Defeat',
          subtitle: game.endedReason === 'ABANDONED' ? 'You abandoned the game' : 'Opponent connected four',
          color: 'text-red-500',
        }
      case 'draw':
        return {
          title: 'Draw!',
          subtitle: 'The board is full',
          color: 'text-yellow-500',
        }
      default:
        return { title: 'Game Over', subtitle: '', color: 'text-gray-600' }
    }
  }

  const getMyResult = (
    result: GameResult,
    playerNumber: 1 | 2 | null
  ): 'win' | 'loss' | 'draw' | null => {
    if (!playerNumber) return null
    if (result === 'DRAW') return 'draw'
    if (result === 'P1_WIN') return playerNumber === 1 ? 'win' : 'loss'
    if (result === 'P2_WIN') return playerNumber === 2 ? 'win' : 'loss'
    return null
  }

  const getRatingChange = (): number | null => {
    if (!myPlayerNumber) return null
    return myPlayerNumber === 1 ? game.p1RatingDelta : game.p2RatingDelta
  }

  const { title, subtitle, color } = getResultText()
  const ratingChange = getRatingChange()
  // Use rematchStatus prop for "I requested" state (immediate feedback)
  // Use game.rematchRequestedBy for "opponent requested" state (from polling)
  const iRequestedRematch = rematchStatus === 'requested' || game.rematchRequestedBy === myPlayerNumber
  const opponentRequestedRematch =
    game.rematchRequestedBy !== null && game.rematchRequestedBy !== myPlayerNumber

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 animate-fade-in">
      <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 animate-scale-in">
        <div className="text-center mb-6">
          <h2 className={`text-4xl font-bold ${color} mb-2 animate-bounce-in`}>{title}</h2>
          {subtitle && <p className="text-gray-500">{subtitle}</p>}
        </div>

        {ratingChange !== null && (
          <div className="bg-gray-100 rounded-xl p-4 mb-6">
            <div className="text-center">
              <div className="text-sm text-gray-500 mb-1">Rating Change</div>
              <div
                className={`text-2xl font-bold ${
                  ratingChange > 0
                    ? 'text-green-500'
                    : ratingChange < 0
                    ? 'text-red-500'
                    : 'text-gray-500'
                }`}
              >
                {ratingChange > 0 ? '+' : ''}
                {ratingChange}
              </div>
            </div>
          </div>
        )}

        <div className="space-y-3">
          {game.rematchPublicId ? (
            <div className="text-center text-green-600 font-medium py-3">
              Rematch accepted! Redirecting...
            </div>
          ) : (
            <>
              <button
                onClick={onRematch}
                disabled={rematchStatus === 'loading' || iRequestedRematch}
                className={`
                  w-full py-3 px-4 rounded-xl font-semibold transition
                  ${
                    opponentRequestedRematch
                      ? 'bg-green-500 hover:bg-green-600 text-white'
                      : iRequestedRematch
                      ? 'bg-gray-200 text-gray-500 cursor-not-allowed'
                      : 'bg-blue-500 hover:bg-blue-600 text-white'
                  }
                  disabled:opacity-50
                `}
              >
                {rematchStatus === 'loading'
                  ? 'Sending...'
                  : opponentRequestedRematch
                  ? 'Accept Rematch'
                  : iRequestedRematch
                  ? 'Request Sent - Waiting for opponent'
                  : 'Request Rematch'}
              </button>

              {opponentRequestedRematch && (
                <p className="text-sm text-center text-gray-500">
                  Opponent wants a rematch! Colors will swap.
                </p>
              )}
            </>
          )}

          <button
            onClick={onBackToLobby}
            className="w-full py-3 px-4 rounded-xl font-semibold bg-gray-200 hover:bg-gray-300 text-gray-700 transition"
          >
            Back to Lobby
          </button>
        </div>
      </div>
    </div>
  )
}
