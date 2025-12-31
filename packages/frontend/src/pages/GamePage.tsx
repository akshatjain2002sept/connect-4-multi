import { useParams, useNavigate } from 'react-router-dom'
import { useState, useCallback } from 'react'
import { useAuthContext } from '../contexts/AuthContext'
import { useGame } from '../hooks/useGame'
import { GameBoard } from '../components/GameBoard'
import { ClaimWinButton } from '../components/ClaimWinButton'
import { GameOverModal } from '../components/GameOverModal'
import { MatchLayout, MatchHeader } from '../components/game'
import { colors } from '../styles/gameTokens'

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
    isInMoveCooldown,
  } = useGame({
    publicId: publicId || '',
    onGameUpdate: (game) => {
      if (game.status === 'COMPLETED' || game.status === 'ABANDONED') {
        setShowGameOver(true)
      }
      if (game.rematchPublicId) {
        navigate(`/game/${game.rematchPublicId}`)
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

  // Loading and error states
  if (!publicId) {
    return (
      <MatchLayout>
        <div className="p-8 text-center">
          <p className="text-white text-lg">Invalid game URL</p>
        </div>
      </MatchLayout>
    )
  }

  if (loading && !game) {
    return (
      <MatchLayout>
        <div className="p-8 text-center">
          <div className="inline-block w-8 h-8 border-2 border-white/20 border-t-white rounded-full animate-spin mb-4" />
          <p className="text-white/60">Loading game...</p>
        </div>
      </MatchLayout>
    )
  }

  if (error && !game) {
    return (
      <MatchLayout>
        <div className="p-8 text-center">
          <p className="text-white text-lg mb-4">Error loading game</p>
          <button
            onClick={() => navigate('/')}
            className="px-4 py-2 rounded-lg bg-white/10 hover:bg-white/20 text-white transition"
          >
            Back to Lobby
          </button>
        </div>
      </MatchLayout>
    )
  }

  if (!game) return null

  // Waiting for opponent
  if (game.status === 'WAITING') {
    return (
      <MatchLayout>
        <div className="p-6 sm:p-8 text-center">
          <div className="mb-6">
            <div className="inline-block w-12 h-12 border-2 border-blue-500/30 border-t-blue-500 rounded-full animate-spin" />
          </div>
          <h2 className="text-xl sm:text-2xl font-bold text-white mb-2">
            Waiting for Opponent
          </h2>
          {game.code && (
            <div className="mt-4 p-4 rounded-lg" style={{ background: colors.bg.card }}>
              <div className="text-xs mb-1" style={{ color: colors.text.muted }}>Share this code</div>
              <div
                className="text-2xl sm:text-3xl font-mono font-bold tracking-widest"
                style={{ color: colors.board.primary }}
              >
                {game.code}
              </div>
            </div>
          )}
          <button
            onClick={() => navigate('/')}
            className="mt-6 w-full py-3 px-4 rounded-lg font-semibold bg-white/5 hover:bg-white/10 text-white/80 transition"
          >
            Cancel
          </button>
        </div>
      </MatchLayout>
    )
  }

  return (
    <MatchLayout>
      {/* Match Header - directly above board */}
      <MatchHeader
        player1={game.player1}
        player2={game.player2}
        currentTurn={game.currentTurn}
        myPlayerNumber={playerInfo?.playerNumber || null}
        gameStatus={game.status}
      />

      {/* Game Board */}
      <div className="p-3 sm:p-4">
        <GameBoard
          board={game.board}
          currentTurn={game.currentTurn}
          isMyTurn={playerInfo?.isMyTurn || false}
          myPlayerNumber={playerInfo?.playerNumber || null}
          onColumnClick={handleColumnClick}
          disabled={moveLoading || game.status !== 'ACTIVE'}
          lastMove={getLastMove()}
        />
      </div>

      {/* Status bar - NO DIVIDER LINES, separation via spacing only */}
      <div
        className="px-4 py-3 text-center"
        style={{
          background: colors.bg.card,
          marginTop: '12px',
        }}
      >
        {/* Turn status - LOCKED text colors */}
        {game.status === 'ACTIVE' && (
          <p
            className="text-sm"
            style={{
              color: playerInfo?.isMyTurn ? colors.text.primary : colors.text.muted,
              fontWeight: 500,
            }}
          >
            {playerInfo?.isMyTurn
              ? "Your turn"
              : `Waiting for ${game.currentTurn === 1 ? game.player1?.username : game.player2?.username}...`}
          </p>
        )}

        {/* Claim Win Button */}
        {isOpponentAbandoned() && user && (
          <div className="mt-3">
            <ClaimWinButton
              game={game}
              myUserId={user.uid}
              onClaim={handleClaimAbandoned}
              loading={moveLoading}
            />
          </div>
        )}

        {/* Error Display - using chip red for errors (allowed color) */}
        {/* Hide errors during move operations and brief cooldown to prevent transient flash */}
        {error && !moveLoading && !isInMoveCooldown() && (
          <div
            className="mt-3 p-3 rounded-lg text-sm"
            style={{
              background: `${colors.chip.red.primary}15`,
              border: `1px solid ${colors.chip.red.primary}30`,
              color: colors.chip.red.light,
            }}
          >
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
    </MatchLayout>
  )
}
