import { useState, useEffect, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { useAuthContext } from '../contexts/AuthContext'
import { api, Game, User } from '../lib/api'

const GAMES_PER_PAGE = 10

export function HistoryPage() {
  const { user } = useAuthContext()
  const [games, setGames] = useState<Game[]>([])
  const [profile, setProfile] = useState<User | null>(null)
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [offset, setOffset] = useState(0)

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const [gamesResult, profileResult] = await Promise.all([
        api.getGameHistory(GAMES_PER_PAGE, offset),
        api.getMe(),
      ])
      setGames(gamesResult.games)
      setTotal(gamesResult.total)
      setProfile(profileResult)
    } catch (err) {
      console.error('Failed to fetch data:', err)
    } finally {
      setLoading(false)
    }
  }, [offset])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  // Get game result for current user
  const getGameResult = (game: Game, userId: string | undefined) => {
    if (!game.result || !userId) return null

    const isPlayer1 = game.player1?.firebaseUid === userId
    const isPlayer2 = game.player2?.firebaseUid === userId

    if (!isPlayer1 && !isPlayer2) return null

    if (game.result === 'DRAW') return 'draw'
    const isWinner =
      (game.result === 'P1_WIN' && isPlayer1) || (game.result === 'P2_WIN' && isPlayer2)
    return isWinner ? 'win' : 'loss'
  }

  // Get opponent info
  const getOpponent = (game: Game, userId: string | undefined) => {
    if (!userId) return null
    const isPlayer1 = game.player1?.firebaseUid === userId
    return isPlayer1 ? game.player2 : game.player1
  }

  // Get rating change for current user
  const getRatingChange = (game: Game, userId: string | undefined): number | null => {
    if (!userId) return null
    const isPlayer1 = game.player1?.firebaseUid === userId
    const isPlayer2 = game.player2?.firebaseUid === userId
    if (isPlayer1) return game.p1RatingDelta
    if (isPlayer2) return game.p2RatingDelta
    return null
  }

  // Format relative time
  const formatTime = (dateString: string): string => {
    const date = new Date(dateString)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffMins = Math.floor(diffMs / 60000)
    const diffHours = Math.floor(diffMs / 3600000)
    const diffDays = Math.floor(diffMs / 86400000)

    if (diffMins < 1) return 'Just now'
    if (diffMins < 60) return `${diffMins}m ago`
    if (diffHours < 24) return `${diffHours}h ago`
    if (diffDays < 7) return `${diffDays}d ago`

    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  }

  const totalPages = Math.ceil(total / GAMES_PER_PAGE)
  const currentPage = Math.floor(offset / GAMES_PER_PAGE) + 1

  // Loading state
  if (loading && games.length === 0) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-blue-600 via-blue-700 to-blue-800 flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-10 h-10 border-3 border-white border-t-transparent rounded-full animate-spin" />
          <span className="text-white/70 text-sm">Loading history...</span>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-600 via-blue-700 to-blue-800">
      {/* Header */}
      <header className="flex items-center justify-between px-4 sm:px-6 py-3 sm:py-4">
        <div className="flex items-center gap-3">
          <Link
            to="/"
            className="text-white/70 hover:text-white transition-colors p-1.5 -ml-1.5"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </Link>
          <h1 className="text-xl sm:text-2xl font-bold text-white">Match History</h1>
        </div>

        {/* Current rating */}
        {profile && (
          <div className="text-white/70 text-sm flex items-center gap-1.5">
            <span className="font-medium text-white">{profile.rating}</span>
            <span className="text-white/50">rating</span>
          </div>
        )}
      </header>

      {/* Stats summary */}
      {profile && games.length > 0 && (
        <div className="px-4 sm:px-6 pb-4">
          <div className="max-w-md mx-auto flex items-center justify-center gap-8 py-4 px-6 rounded-2xl bg-white/10 backdrop-blur-sm">
            <div className="text-center">
              <div className="text-2xl font-bold text-green-300">{profile.wins}</div>
              <div className="text-xs text-white/50">Wins</div>
            </div>
            <div className="w-px h-10 bg-white/20" />
            <div className="text-center">
              <div className="text-2xl font-bold text-red-300">{profile.losses}</div>
              <div className="text-xs text-white/50">Losses</div>
            </div>
            <div className="w-px h-10 bg-white/20" />
            <div className="text-center">
              <div className="text-2xl font-bold text-white/70">{profile.draws}</div>
              <div className="text-xs text-white/50">Draws</div>
            </div>
          </div>
        </div>
      )}

      {/* Games List */}
      <div className="px-4 sm:px-6 pb-8">
        <div className="max-w-md mx-auto">
          {games.length === 0 ? (
            <div className="text-center py-12 rounded-2xl bg-white/10 backdrop-blur-sm">
              <div className="text-4xl mb-3">🎮</div>
              <p className="text-white/60 mb-4">No games played yet</p>
              <Link
                to="/"
                className="inline-block px-6 py-2.5 rounded-xl font-semibold bg-white text-blue-700 hover:bg-gray-100 transition"
              >
                Play Your First Game
              </Link>
            </div>
          ) : (
            <>
              <div className="space-y-2">
                {games.map((game) => {
                  const result = getGameResult(game, user?.uid)
                  const opponent = getOpponent(game, user?.uid)
                  const ratingChange = getRatingChange(game, user?.uid)

                  // Result colors
                  const resultConfig = {
                    win: { bg: 'bg-green-500/20', text: 'text-green-300', label: 'W' },
                    loss: { bg: 'bg-red-500/20', text: 'text-red-300', label: 'L' },
                    draw: { bg: 'bg-white/10', text: 'text-white/60', label: 'D' },
                  }
                  const rc = result ? resultConfig[result] : resultConfig.draw

                  return (
                    <div
                      key={game.id}
                      className="rounded-xl p-4 bg-white/10 backdrop-blur-sm hover:bg-white/15 transition"
                    >
                      <div className="flex items-center gap-3">
                        {/* Result indicator */}
                        <div
                          className={`w-11 h-11 rounded-lg flex items-center justify-center flex-shrink-0 ${rc.bg}`}
                        >
                          <span className={`text-sm font-bold ${rc.text}`}>{rc.label}</span>
                        </div>

                        {/* Match info */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-white truncate">
                              {opponent?.username || 'Unknown'}
                            </span>
                            {game.endedReason === 'ABANDONED' && (
                              <span className="text-xs px-1.5 py-0.5 rounded bg-yellow-500/20 text-yellow-300">
                                Left
                              </span>
                            )}
                            {game.endedReason === 'RESIGNED' && (
                              <span className="text-xs px-1.5 py-0.5 rounded bg-white/10 text-white/50">
                                Resigned
                              </span>
                            )}
                          </div>
                          <div className="text-xs text-white/50 mt-0.5">
                            {formatTime(game.completedAt || game.updatedAt)}
                          </div>
                        </div>

                        {/* Rating change */}
                        {ratingChange !== null && (
                          <div className="text-right flex-shrink-0">
                            <div
                              className={`text-sm font-semibold ${
                                ratingChange > 0
                                  ? 'text-green-300'
                                  : ratingChange < 0
                                  ? 'text-red-300'
                                  : 'text-white/50'
                              }`}
                            >
                              {ratingChange > 0 ? '+' : ''}
                              {ratingChange}
                            </div>
                            <div className="text-xs text-white/40">rating</div>
                          </div>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="flex items-center justify-between mt-4 px-4 py-3 rounded-xl bg-white/10">
                  <button
                    onClick={() => setOffset(Math.max(0, offset - GAMES_PER_PAGE))}
                    disabled={offset === 0}
                    className="px-3 py-1.5 rounded-lg text-sm font-medium transition text-white/70 hover:text-white hover:bg-white/10 disabled:opacity-30 disabled:hover:bg-transparent"
                  >
                    ← Prev
                  </button>
                  <span className="text-sm text-white/50">
                    {currentPage} / {totalPages}
                  </span>
                  <button
                    onClick={() => setOffset(offset + GAMES_PER_PAGE)}
                    disabled={currentPage >= totalPages}
                    className="px-3 py-1.5 rounded-lg text-sm font-medium transition text-white/70 hover:text-white hover:bg-white/10 disabled:opacity-30 disabled:hover:bg-transparent"
                  >
                    Next →
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
