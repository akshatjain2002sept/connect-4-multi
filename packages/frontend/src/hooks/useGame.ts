import { useState, useCallback, useRef } from 'react'
import { api, Game, ApiError } from '../lib/api'
import { usePolling } from './usePolling'
import { useAuthContext } from '../contexts/AuthContext'

const POLL_INTERVAL = 2000 // 2 seconds as per spec
const ABANDON_THRESHOLD_MS = 30 * 1000 // 30 seconds
const MOVE_COOLDOWN_MS = 500 // Brief cooldown after move to prevent error flash

interface UseGameOptions {
  publicId: string
  onGameUpdate?: (game: Game) => void
}

export function useGame({ publicId, onGameUpdate }: UseGameOptions) {
  const { user } = useAuthContext()
  const [game, setGame] = useState<Game | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<ApiError | null>(null)
  const [moveLoading, setMoveLoading] = useState(false)
  const lastMoveTimeRef = useRef<number>(0)

  const fetchGame = useCallback(async () => {
    return api.getGameByPublicId(publicId)
  }, [publicId])

  const handleGameData = useCallback(
    (data: Game) => {
      setGame(data)
      setLoading(false)
      setError(null)
      onGameUpdate?.(data)
    },
    [onGameUpdate]
  )

  // Polling errors are silent - only show errors from explicit user actions
  // Polling will retry on next interval anyway
  const handlePollingError = useCallback((_err: Error) => {
    // Don't set error state for polling failures
    // Just ensure loading is false so UI doesn't get stuck
    setLoading(false)
  }, [])

  // Continue polling for:
  // 1. Active/waiting games (normal gameplay)
  // 2. Completed/abandoned games that don't have a rematch yet (for rematch detection)
  // Stop polling only when: no publicId, during move, or rematch already created
  const shouldPoll = !!publicId && !moveLoading && !game?.rematchPublicId

  const { refresh } = usePolling(fetchGame, handleGameData, {
    enabled: shouldPoll,
    interval: POLL_INTERVAL,
    onError: handlePollingError,
  })

  const makeMove = useCallback(
    async (column: number) => {
      if (!game) return

      setMoveLoading(true)
      setError(null)

      try {
        const result = await api.makeMove(game.id, column)
        setGame(result.game)
        setError(null) // Explicitly clear error after successful move
        lastMoveTimeRef.current = Date.now() // Track successful move time
        return result
      } catch (err) {
        const apiError = err as ApiError
        setError(apiError)

        // On conflict, refresh game state
        if (apiError.code === 'NOT_YOUR_TURN' || apiError.code === 'COLUMN_FULL') {
          refresh()
        }

        throw err
      } finally {
        setMoveLoading(false)
      }
    },
    [game, refresh]
  )

  const claimAbandoned = useCallback(async () => {
    if (!game) return

    try {
      const result = await api.claimAbandoned(game.id)
      setGame(result.game)
      return result
    } catch (err) {
      setError(err as ApiError)
      throw err
    }
  }, [game])

  const resign = useCallback(async () => {
    if (!game) return

    try {
      const result = await api.resign(game.id)
      setGame(result.game)
      return result
    } catch (err) {
      setError(err as ApiError)
      throw err
    }
  }, [game])

  const requestRematch = useCallback(async () => {
    if (!game) return

    try {
      const result = await api.requestRematch(game.id)
      // Only refresh if request is pending (not accepted)
      // When accepted, caller will navigate to new game
      if (result.status === 'requested') {
        refresh()
      }
      return result
    } catch (err) {
      setError(err as ApiError)
      throw err
    }
  }, [game, refresh])

  // Determine if opponent has abandoned
  const isOpponentAbandoned = useCallback(() => {
    if (!game || !user || game.status !== 'ACTIVE' || !game.player2Id) {
      return false
    }

    const isPlayer1 = user.uid === game.player1?.firebaseUid
    const opponentLastSeen = isPlayer1 ? game.player2LastSeen : game.player1LastSeen

    if (!opponentLastSeen) return false

    const timeSince = Date.now() - new Date(opponentLastSeen).getTime()
    return timeSince > ABANDON_THRESHOLD_MS
  }, [game, user])

  // Determine current player info
  const getPlayerInfo = useCallback(() => {
    if (!game || !user) return null

    const isPlayer1 = user.uid === game.player1?.firebaseUid
    const isPlayer2 = user.uid === game.player2?.firebaseUid

    if (!isPlayer1 && !isPlayer2) return null

    const playerNumber: 1 | 2 = isPlayer1 ? 1 : 2
    const isMyTurn = game.status === 'ACTIVE' && game.currentTurn === playerNumber

    return {
      playerNumber,
      isMyTurn,
      isPlayer1,
      isPlayer2,
      myData: isPlayer1 ? game.player1 : game.player2,
      opponentData: isPlayer1 ? game.player2 : game.player1,
    }
  }, [game, user])

  // Check if we're in the brief cooldown period after a successful move
  // During this period, transient errors should not be shown
  const isInMoveCooldown = useCallback(() => {
    return Date.now() - lastMoveTimeRef.current < MOVE_COOLDOWN_MS
  }, [])

  return {
    game,
    loading,
    error,
    moveLoading,
    makeMove,
    claimAbandoned,
    resign,
    requestRematch,
    refresh,
    isOpponentAbandoned,
    getPlayerInfo,
    isInMoveCooldown,
  }
}
