import { useParams, useNavigate } from 'react-router-dom'
import { useState, useCallback, useEffect, useRef } from 'react'
import { useAuthContext } from '../contexts/AuthContext'
import { useGame } from '../hooks/useGame'
import { api } from '../lib/api'
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
  const [showResignConfirm, setShowResignConfirm] = useState(false)
  const [resignLoading, setResignLoading] = useState(false)
  const [cancelLoading, setCancelLoading] = useState(false)
  const [rematchStatus, setRematchStatus] = useState<'none' | 'requested' | 'pending' | 'loading'>(
    'none'
  )
  const [codeCopied, setCodeCopied] = useState(false)
  const [waitingElapsed, setWaitingElapsed] = useState(0)
  const waitingStartRef = useRef<number>(Date.now())

  const {
    game,
    loading,
    error,
    moveLoading,
    makeMove,
    claimAbandoned,
    resign,
    requestRematch,
    isOpponentAbandoned,
    getPlayerInfo,
    isInMoveCooldown,
  } = useGame({
    publicId: publicId || '',
    onGameUpdate: (game) => {
      // If rematch is ready, navigate immediately (before showing game over)
      if (game.rematchPublicId) {
        navigate(`/game/${game.rematchPublicId}`, { replace: true })
        return
      }
      if (game.status === 'COMPLETED' || game.status === 'ABANDONED') {
        setShowGameOver(true)
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

  // Reset ALL UI state when navigating to a new game (e.g., after rematch)
  useEffect(() => {
    setShowGameOver(false)
    setRematchStatus('none')
    setShowResignConfirm(false)
    setCancelLoading(false)
    setCodeCopied(false)
    setWaitingElapsed(0)
    waitingStartRef.current = Date.now()
  }, [publicId])

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
      if (result?.status === 'accepted' && result.newPublicId) {
        // Navigate to new game, replacing current entry to prevent back navigation
        navigate(`/game/${result.newPublicId}`, { replace: true })
        return
      }
      setRematchStatus('requested')
    } catch {
      setRematchStatus('none')
    }
  }, [requestRematch, navigate])

  const handleBackToLobby = useCallback(() => {
    navigate('/')
  }, [navigate])

  const handleResign = useCallback(async () => {
    setResignLoading(true)
    try {
      await resign()
      setShowResignConfirm(false)
    } catch {
      // Error already handled
    } finally {
      setResignLoading(false)
    }
  }, [resign])

  const handleCancelGame = useCallback(async () => {
    if (!game) return
    setCancelLoading(true)
    try {
      await api.cancelGame(game.id)
      navigate('/')
    } catch {
      // If cancel fails (e.g., opponent already joined), just navigate home
      navigate('/')
    }
  }, [game, navigate])

  // Get last move for highlighting
  const getLastMove = () => {
    if (!game?.moves || game.moves.length === 0) return null
    const lastMove = game.moves[game.moves.length - 1]
    return { row: lastMove.row, column: lastMove.column }
  }

  // Elapsed time counter for waiting screen
  useEffect(() => {
    if (game?.status !== 'WAITING') return

    waitingStartRef.current = Date.now()
    setWaitingElapsed(0)

    const interval = setInterval(() => {
      setWaitingElapsed(Math.floor((Date.now() - waitingStartRef.current) / 1000))
    }, 1000)

    return () => clearInterval(interval)
  }, [game?.status])

  // Copy game code to clipboard
  const handleCopyCode = useCallback(async () => {
    if (!game?.code) return

    try {
      await navigator.clipboard.writeText(game.code)
      setCodeCopied(true)
      setTimeout(() => setCodeCopied(false), 2000)
    } catch {
      // Fallback for older browsers
      const textArea = document.createElement('textarea')
      textArea.value = game.code
      document.body.appendChild(textArea)
      textArea.select()
      document.execCommand('copy')
      document.body.removeChild(textArea)
      setCodeCopied(true)
      setTimeout(() => setCodeCopied(false), 2000)
    }
  }, [game?.code])

  // Share game link
  const handleShare = useCallback(async () => {
    const shareUrl = window.location.href
    const shareData = {
      title: 'Connect 4 - Join my game!',
      text: `Join my Connect 4 game! Code: ${game?.code}`,
      url: shareUrl,
    }

    if (navigator.share) {
      try {
        await navigator.share(shareData)
      } catch {
        // User cancelled or share failed, fall back to copy
        handleCopyCode()
      }
    } else {
      // Fallback: copy link to clipboard
      try {
        await navigator.clipboard.writeText(shareUrl)
        setCodeCopied(true)
        setTimeout(() => setCodeCopied(false), 2000)
      } catch {
        handleCopyCode()
      }
    }
  }, [game?.code, handleCopyCode])

  // Format elapsed time
  const formatElapsed = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}:${secs.toString().padStart(2, '0')}`
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

  // Show loading if: still loading, no game data, OR game data is stale (different publicId)
  if (loading || !game || game.publicId !== publicId) {
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

  // Waiting for opponent - enhanced UI
  if (game.status === 'WAITING') {
    // Tips that rotate
    const tips = [
      "Connect 4 in a row horizontally, vertically, or diagonally to win!",
      "Control the center columns for more winning opportunities.",
      "Block your opponent while building your own lines.",
      "Think ahead - plan multiple moves in advance.",
    ]
    const currentTip = tips[Math.floor(waitingElapsed / 8) % tips.length]

    return (
      <MatchLayout>
        <div className="flex flex-col h-full">
          {/* Header - elapsed time only, cleaner */}
          <div className="flex items-center justify-center px-4 py-3" style={{ background: colors.bg.card }}>
            <div className="flex items-center gap-2 text-xs" style={{ color: colors.text.muted }}>
              <span>Waiting</span>
              <span style={{ color: colors.text.secondary, fontFamily: 'ui-monospace, monospace' }}>
                {formatElapsed(waitingElapsed)}
              </span>
            </div>
          </div>

          {/* Main content */}
          <div className="flex-1 flex flex-col items-center justify-center p-6 sm:p-8">
            {/* Themed loading animation - wave bounce effect */}
            <div className="flex items-end gap-2 mb-6 h-10">
              {[
                { color: colors.chip.red.primary, glow: colors.chip.red.glow, delay: 0 },
                { color: colors.chip.yellow.primary, glow: colors.chip.yellow.glow, delay: 100 },
                { color: colors.chip.red.primary, glow: colors.chip.red.glow, delay: 200 },
                { color: colors.chip.yellow.primary, glow: colors.chip.yellow.glow, delay: 300 },
              ].map((chip, i) => (
                <div
                  key={i}
                  className="w-4 h-4 rounded-full"
                  style={{
                    background: chip.color,
                    boxShadow: `0 2px 8px ${chip.glow}`,
                    animation: `wave 1.2s ease-in-out ${chip.delay}ms infinite`,
                  }}
                />
              ))}
            </div>
            {/* Wave animation keyframes */}
            <style>{`
              @keyframes wave {
                0%, 100% { transform: translateY(0); }
                50% { transform: translateY(-12px); }
              }
            `}</style>

            {/* Status */}
            <h2
              className="text-xl sm:text-2xl font-bold mb-6 tracking-tight"
              style={{ color: colors.text.primary }}
            >
              Waiting for Opponent
            </h2>

            {/* Game Code - The Focal Point */}
            {game.code && (
              <div
                className="w-full max-w-xs rounded-xl p-5 mb-4"
                style={{
                  background: colors.bg.card,
                  border: `1px solid ${colors.bg.cardBorder}`,
                }}
              >
                <div className="text-xs mb-3 text-center" style={{ color: colors.text.muted }}>
                  Share this code with your friend
                </div>

                {/* Large code display - explicitly monospace for consistent width */}
                <div
                  className="text-3xl sm:text-4xl font-bold text-center py-3 px-4 rounded-lg mb-4"
                  style={{
                    background: 'rgba(0,0,0,0.2)',
                    color: colors.text.primary,
                    fontFamily: 'ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, monospace',
                    letterSpacing: '0.3em',
                  }}
                >
                  {game.code}
                </div>

                {/* Action buttons */}
                <div className="flex gap-2">
                  <button
                    onClick={handleCopyCode}
                    className="flex-1 flex items-center justify-center gap-2 py-2.5 px-3 rounded-lg font-medium text-sm transition"
                    style={{
                      background: codeCopied ? 'rgba(34, 197, 94, 0.2)' : colors.board.primary,
                      color: codeCopied ? '#22c55e' : colors.text.primary,
                    }}
                  >
                    {codeCopied ? (
                      <>
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                        Copied!
                      </>
                    ) : (
                      <>
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
                          />
                        </svg>
                        Copy Code
                      </>
                    )}
                  </button>
                  <button
                    onClick={handleShare}
                    className="flex items-center justify-center gap-2 py-2.5 px-4 rounded-lg font-medium text-sm transition hover:bg-white/10"
                    style={{
                      background: 'rgba(255,255,255,0.1)',
                      color: colors.text.secondary,
                    }}
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z"
                      />
                    </svg>
                    Share
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Tips section */}
          <div
            className="px-4 py-3 text-center"
            style={{ background: colors.bg.card }}
          >
            <div className="flex items-center justify-center gap-2 mb-1.5">
              <svg
                className="w-3.5 h-3.5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                style={{ color: colors.chip.yellow.primary }}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"
                />
              </svg>
              <span className="text-xs font-medium" style={{ color: colors.text.muted }}>
                Tip
              </span>
            </div>
            <p
              className="text-xs max-w-xs mx-auto leading-relaxed"
              style={{ color: colors.text.secondary }}
            >
              {currentTip}
            </p>
          </div>

          {/* Cancel button - bottom placement feels more native */}
          <div className="px-4 pb-4 pt-2" style={{ background: colors.bg.card }}>
            <button
              onClick={handleCancelGame}
              disabled={cancelLoading}
              className="w-full py-3 px-4 rounded-xl font-medium text-sm transition hover:bg-white/10 flex items-center justify-center gap-2 disabled:opacity-50"
              style={{
                background: 'rgba(255,255,255,0.05)',
                color: colors.text.muted,
              }}
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
              {cancelLoading ? 'Cancelling...' : 'Cancel'}
            </button>
          </div>
        </div>
      </MatchLayout>
    )
  }

  return (
    <MatchLayout>
      {/* Action bar - Lobby and Resign buttons */}
      <div
        className="flex items-center justify-between px-3 py-2"
        style={{ background: colors.bg.card }}
      >
        <button
          onClick={handleBackToLobby}
          className="flex items-center gap-1 px-2 py-1 rounded text-xs transition hover:bg-white/10"
          style={{ color: colors.text.muted }}
        >
          <span>←</span>
          <span>Lobby</span>
        </button>

        {/* Resign button - only show during active game when user is a player */}
        {game.status === 'ACTIVE' && playerInfo && (
          <button
            onClick={() => setShowResignConfirm(true)}
            className="px-2 py-1 rounded text-xs transition hover:bg-white/10"
            style={{ color: colors.text.muted }}
          >
            Resign
          </button>
        )}
      </div>

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

      {/* Resign Confirmation Dialog */}
      {showResignConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div
            className="w-full max-w-sm rounded-xl p-6"
            style={{ background: colors.bg.card }}
          >
            <h3
              className="text-lg font-semibold mb-2"
              style={{ color: colors.text.primary }}
            >
              Resign Game?
            </h3>
            <p
              className="text-sm mb-6"
              style={{ color: colors.text.muted }}
            >
              You will forfeit this game and your opponent will win. This cannot be undone.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowResignConfirm(false)}
                disabled={resignLoading}
                className="flex-1 py-2 px-4 rounded-lg font-medium transition bg-white/10 hover:bg-white/20"
                style={{ color: colors.text.secondary }}
              >
                Cancel
              </button>
              <button
                onClick={handleResign}
                disabled={resignLoading}
                className="flex-1 py-2 px-4 rounded-lg font-medium transition"
                style={{
                  background: colors.chip.red.primary,
                  color: colors.text.primary,
                  opacity: resignLoading ? 0.7 : 1,
                }}
              >
                {resignLoading ? 'Resigning...' : 'Resign'}
              </button>
            </div>
          </div>
        </div>
      )}
    </MatchLayout>
  )
}
