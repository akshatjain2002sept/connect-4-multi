import { useState, useCallback } from 'react'
import { api, Game, ApiError } from '../lib/api'
import { usePolling } from './usePolling'
import { useAuthContext } from '../contexts/AuthContext'

const POLL_INTERVAL = 2000 // 2 seconds as per spec
const ABANDON_THRESHOLD_MS = 30 * 1000 // 30 seconds

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

  const handleError = useCallback((err: Error) => {
    setError(err as unknown as ApiError)
    setLoading(false)
  }, [])

  const { refresh } = usePolling(fetchGame, handleGameData, {
    enabled: !!publicId && game?.status !== 'COMPLETED' && game?.status !== 'ABANDONED',
    interval: POLL_INTERVAL,
    onError: handleError,
  })

  const makeMove = useCallback(
    async (column: number) => {
      if (!game) return

      setMoveLoading(true)
      setError(null)

      try {
        const result = await api.makeMove(game.id, column)
        setGame(result.game)
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

  const requestRematch = useCallback(async () => {
    if (!game) return

    try {
      return await api.requestRematch(game.id)
    } catch (err) {
      setError(err as ApiError)
      throw err
    }
  }, [game])

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

  return {
    game,
    loading,
    error,
    moveLoading,
    makeMove,
    claimAbandoned,
    requestRematch,
    refresh,
    isOpponentAbandoned,
    getPlayerInfo,
  }
}
