import { useState, useEffect, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { useAuthContext } from '../contexts/AuthContext'
import { api, Game } from '../lib/api'

const GAMES_PER_PAGE = 10

export function HistoryPage() {
  const { user, signOut } = useAuthContext()
  const [games, setGames] = useState<Game[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [offset, setOffset] = useState(0)

  const fetchGames = useCallback(async () => {
    setLoading(true)
    try {
      const result = await api.getGameHistory(GAMES_PER_PAGE, offset)
      setGames(result.games)
      setTotal(result.total)
    } catch (err) {
      console.error('Failed to fetch game history:', err)
    } finally {
      setLoading(false)
    }
  }, [offset])

  useEffect(() => {
    fetchGames()
  }, [fetchGames])

  const getResultBadge = (game: Game, userId: string | undefined) => {
    if (!game.result || !userId) return null

    const isPlayer1 = game.player1?.firebaseUid === userId
    const isPlayer2 = game.player2?.firebaseUid === userId

    if (!isPlayer1 && !isPlayer2) return null

    if (game.result === 'DRAW') {
      return (
        <span className="px-2 py-1 text-xs font-semibold rounded-full bg-gray-200 text-gray-700">
          Draw
        </span>
      )
    }

    const isWinner =
      (game.result === 'P1_WIN' && isPlayer1) || (game.result === 'P2_WIN' && isPlayer2)

    return (
      <span
        className={`px-2 py-1 text-xs font-semibold rounded-full ${
          isWinner ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
        }`}
      >
        {isWinner ? 'Won' : 'Lost'}
      </span>
    )
  }

  const getRatingChange = (game: Game, userId: string | undefined): number | null => {
    if (!userId) return null

    const isPlayer1 = game.player1?.firebaseUid === userId
    const isPlayer2 = game.player2?.firebaseUid === userId

    if (isPlayer1) return game.p1RatingDelta
    if (isPlayer2) return game.p2RatingDelta
    return null
  }

  const formatDate = (dateString: string): string => {
    const date = new Date(dateString)
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  const totalPages = Math.ceil(total / GAMES_PER_PAGE)
  const currentPage = Math.floor(offset / GAMES_PER_PAGE) + 1

  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-500 to-blue-700">
      <div className="container mx-auto px-3 sm:px-4 py-4 sm:py-8">
        {/* Header */}
        <div className="flex justify-between items-center mb-4 sm:mb-8">
          <div className="flex items-center gap-2 sm:gap-4">
            <Link
              to="/"
              className="text-white hover:text-white/80 transition p-1"
            >
              <svg className="w-5 h-5 sm:w-6 sm:h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M15 19l-7-7 7-7"
                />
              </svg>
            </Link>
            <h1 className="text-xl sm:text-3xl font-bold text-white">Match History</h1>
          </div>
          <button
            onClick={signOut}
            className="bg-white/20 text-white px-3 py-1.5 sm:px-4 sm:py-2 rounded-lg hover:bg-white/30 transition text-sm sm:text-base"
          >
            Sign Out
          </button>
        </div>

        {/* Games List */}
        <div className="bg-white rounded-xl sm:rounded-2xl shadow-2xl p-4 sm:p-6 max-w-3xl mx-auto">
          {loading ? (
            <div className="text-center py-12 text-gray-500">Loading...</div>
          ) : games.length === 0 ? (
            <div className="text-center py-12">
              <div className="text-6xl mb-4">🎮</div>
              <div className="text-gray-500">No games played yet</div>
              <Link
                to="/"
                className="inline-block mt-4 bg-blue-500 text-white px-6 py-2 rounded-lg hover:bg-blue-600 transition"
              >
                Play Now
              </Link>
            </div>
          ) : (
            <>
              <div className="space-y-2 sm:space-y-3">
                {games.map((game) => {
                  const ratingChange = getRatingChange(game, user?.uid)

                  return (
                    <div
                      key={game.id}
                      className="flex items-center justify-between p-3 sm:p-4 bg-gray-50 rounded-lg sm:rounded-xl hover:bg-gray-100 transition gap-2"
                    >
                      <div className="flex items-center gap-2 sm:gap-4 min-w-0">
                        {getResultBadge(game, user?.uid)}
                        <div className="min-w-0">
                          <div className="font-medium text-gray-800 text-sm sm:text-base truncate">
                            vs{' '}
                            {game.player1?.firebaseUid === user?.uid
                              ? game.player2?.username || 'Unknown'
                              : game.player1?.username || 'Unknown'}
                          </div>
                          <div className="text-xs sm:text-sm text-gray-500">
                            {formatDate(game.completedAt || game.updatedAt)}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 sm:gap-4 flex-shrink-0">
                        {ratingChange !== null && (
                          <div
                            className={`font-semibold text-sm sm:text-base ${
                              ratingChange > 0
                                ? 'text-green-600'
                                : ratingChange < 0
                                ? 'text-red-600'
                                : 'text-gray-500'
                            }`}
                          >
                            {ratingChange > 0 ? '+' : ''}
                            {ratingChange}
                          </div>
                        )}
                        {game.endedReason === 'ABANDONED' && (
                          <span className="text-xs text-yellow-600 hidden sm:inline">Abandoned</span>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="flex justify-center items-center gap-2 sm:gap-4 mt-4 sm:mt-6 pt-4 sm:pt-6 border-t border-gray-200">
                  <button
                    onClick={() => setOffset(Math.max(0, offset - GAMES_PER_PAGE))}
                    disabled={offset === 0}
                    className="px-3 py-1.5 sm:px-4 sm:py-2 rounded-lg bg-gray-200 hover:bg-gray-300 disabled:opacity-50 disabled:cursor-not-allowed transition text-sm sm:text-base min-h-[44px] min-w-[44px]"
                  >
                    Prev
                  </button>
                  <span className="text-gray-600 text-sm sm:text-base">
                    {currentPage}/{totalPages}
                  </span>
                  <button
                    onClick={() => setOffset(offset + GAMES_PER_PAGE)}
                    disabled={currentPage >= totalPages}
                    className="px-3 py-1.5 sm:px-4 sm:py-2 rounded-lg bg-gray-200 hover:bg-gray-300 disabled:opacity-50 disabled:cursor-not-allowed transition text-sm sm:text-base min-h-[44px] min-w-[44px]"
                  >
                    Next
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}
