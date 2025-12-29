import { useParams, useNavigate } from 'react-router-dom'
import { useState, useEffect, useCallback } from 'react'
import { useAuthContext } from '../contexts/AuthContext'
import { useGame } from '../hooks/useGame'
import { GameBoard } from '../components/GameBoard'
import { ClaimWinButton } from '../components/ClaimWinButton'
import { GameOverModal } from '../components/GameOverModal'

export function GamePage() {
  const { publicId } = useParams<{ publicId: string }>()
  const navigate = useNavigate()
  const { user } = useAuthContext()
  const [showGameOver, setShowGameOver] = useState(false)
  const [rematchStatus, setRematchStatus] = useState<'none' | 'requested' | 'pending' | 'loading'>(
    'none'
  )

  const {
    game,
    loading,
    error,
    moveLoading,
    makeMove,
    claimAbandoned,
    requestRematch,
    isOpponentAbandoned,
    getPlayerInfo,
  } = useGame({
    publicId: publicId || '',
    onGameUpdate: (game) => {
      if (game.status === 'COMPLETED' || game.status === 'ABANDONED') {
        setShowGameOver(true)
      }
      if (game.rematchGameId) {
        navigate(`/game/${game.rematchGameId}`)
      }
      if (game.rematchRequestedBy) {
        const playerInfo = getPlayerInfo()
        if (playerInfo && game.rematchRequestedBy !== playerInfo.playerNumber) {
          setRematchStatus('pending')
        }
      }
    },
  })

  const playerInfo = getPlayerInfo()

  const handleColumnClick = useCallback(
    async (column: number) => {
      try {
        await makeMove(column)
      } catch {
        // Error already handled in useGame
      }
    },
    [makeMove]
  )

  const handleClaimAbandoned = useCallback(async () => {
    try {
      await claimAbandoned()
    } catch {
      // Error already handled
    }
  }, [claimAbandoned])

  const handleRematch = useCallback(async () => {
    setRematchStatus('loading')
    try {
      const result = await requestRematch()
      if (result?.status === 'accepted') {
        navigate(`/game/${result.newPublicId}`)
      } else {
        setRematchStatus('requested')
      }
    } catch {
      setRematchStatus('none')
    }
  }, [requestRematch, navigate])

  const handleBackToLobby = useCallback(() => {
    navigate('/')
  }, [navigate])

  // Get last move for highlighting
  const getLastMove = () => {
    if (!game?.moves || game.moves.length === 0) return null
    const lastMove = game.moves[game.moves.length - 1]
    return { row: lastMove.row, column: lastMove.column }
  }

  if (!publicId) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-blue-500 to-blue-700 flex items-center justify-center">
        <div className="text-white text-xl">Invalid game URL</div>
      </div>
    )
  }

  if (loading && !game) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-blue-500 to-blue-700 flex items-center justify-center">
        <div className="text-white text-xl">Loading game...</div>
      </div>
    )
  }

  if (error && !game) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-blue-500 to-blue-700 flex items-center justify-center">
        <div className="text-center text-white">
          <div className="text-xl mb-4">Error loading game</div>
          <button
            onClick={() => navigate('/')}
            className="bg-white/20 px-4 py-2 rounded-lg hover:bg-white/30 transition"
          >
            Back to Lobby
          </button>
        </div>
      </div>
    )
  }

  if (!game) return null

  // Waiting for opponent
  if (game.status === 'WAITING') {
    return (
      <div className="min-h-screen bg-gradient-to-b from-blue-500 to-blue-700 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-2xl p-8 max-w-md w-full text-center">
          <div className="animate-pulse mb-6">
            <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto">
              <svg
                className="w-8 h-8 text-blue-500"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
            </div>
          </div>
          <h2 className="text-2xl font-bold text-gray-800 mb-2">Waiting for Opponent</h2>
          {game.code && (
            <div className="bg-gray-100 rounded-xl p-4 mb-6">
              <div className="text-sm text-gray-500 mb-1">Share this code</div>
              <div className="text-3xl font-mono font-bold text-blue-600 tracking-wider">
                {game.code}
              </div>
            </div>
          )}
          <button
            onClick={() => navigate('/')}
            className="w-full py-3 px-4 rounded-xl font-semibold bg-gray-200 hover:bg-gray-300 text-gray-700 transition"
          >
            Cancel
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-500 to-blue-700 py-8 px-4">
      <div className="container mx-auto max-w-lg">
        {/* Header */}
        <div className="flex justify-between items-center mb-6 text-white">
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded-full bg-red-500" />
            <span className="font-medium">
              {game.player1?.username || 'Player 1'}
              {playerInfo?.playerNumber === 1 && ' (You)'}
            </span>
          </div>
          <div className="text-sm opacity-75">vs</div>
          <div className="flex items-center gap-2">
            <span className="font-medium">
              {game.player2?.username || 'Player 2'}
              {playerInfo?.playerNumber === 2 && ' (You)'}
            </span>
            <div className="w-4 h-4 rounded-full bg-yellow-400" />
          </div>
        </div>

        {/* Game Board */}
        <GameBoard
          board={game.board}
          currentTurn={game.currentTurn}
          isMyTurn={playerInfo?.isMyTurn || false}
          myPlayerNumber={playerInfo?.playerNumber || null}
          onColumnClick={handleColumnClick}
          disabled={moveLoading || game.status !== 'ACTIVE'}
          lastMove={getLastMove()}
        />

        {/* Claim Win Button */}
        {isOpponentAbandoned() && user && (
          <div className="mt-6 flex justify-center">
            <ClaimWinButton
              game={game}
              myUserId={user.uid}
              onClaim={handleClaimAbandoned}
              loading={moveLoading}
            />
          </div>
        )}

        {/* Error Display */}
        {error && (
          <div className="mt-4 bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded-xl text-center">
            {error.code || 'An error occurred'}
          </div>
        )}
      </div>

      {/* Game Over Modal */}
      {showGameOver && (
        <GameOverModal
          game={game}
          myPlayerNumber={playerInfo?.playerNumber || null}
          onRematch={handleRematch}
          onBackToLobby={handleBackToLobby}
          rematchStatus={rematchStatus}
        />
      )}
    </div>
  )
}
