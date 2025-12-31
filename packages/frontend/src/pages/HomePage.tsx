import { useState, useEffect, useCallback } from 'react'
import { useNavigate, Link, useSearchParams } from 'react-router-dom'
import { useAuthContext } from '../contexts/AuthContext'
import { api, User } from '../lib/api'
import { MatchmakingModal } from '../components/MatchmakingModal'
import { PreviewBoard } from '../components/PreviewBoard'

export function HomePage() {
  const { user, signOut, getIdToken } = useAuthContext()
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const [profile, setProfile] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const [showMatchmaking, setShowMatchmaking] = useState(false)
  const [showPlayModal, setShowPlayModal] = useState(false)
  const [playModalMode, setPlayModalMode] = useState<'choose' | 'friend-choose' | 'friend-join'>('choose')
  const [joinCode, setJoinCode] = useState('')
  const [joinError, setJoinError] = useState<string | null>(null)
  const [creatingGame, setCreatingGame] = useState(false)
  const [joiningGame, setJoiningGame] = useState(false)
  const [activeGamePublicId, setActiveGamePublicId] = useState<string | null>(null)

  // Fetch or create user profile
  useEffect(() => {
    const initProfile = async () => {
      if (!user) return

      try {
        await getIdToken()

        try {
          const existingProfile = await api.getMe()
          setProfile(existingProfile)
        } catch {
          const newProfile = await api.updateMe({
            username: user.displayName || generateGuestUsername(),
          })
          setProfile(newProfile)
        }

        // Check for active game but don't auto-redirect
        // Show banner instead so user can choose
        const activeGame = await api.getActiveGame()
        if (activeGame) {
          setActiveGamePublicId(activeGame.publicId)
        }
      } catch (err) {
        console.error('Failed to initialize profile:', err)
      } finally {
        setLoading(false)
      }
    }

    initProfile()
  }, [user, getIdToken])

  const handleCreatePrivateGame = useCallback(async () => {
    setCreatingGame(true)
    try {
      const game = await api.createPrivateGame()
      navigate(`/game/${game.publicId}`)
    } catch (err) {
      console.error('Failed to create game:', err)
    } finally {
      setCreatingGame(false)
    }
  }, [navigate])

  const handleJoinGame = useCallback(async () => {
    if (!joinCode.trim()) {
      setJoinError('Please enter a game code')
      return
    }

    setJoiningGame(true)
    setJoinError(null)

    try {
      const result = await api.joinGame(joinCode.toUpperCase())
      navigate(`/game/${result.publicId}`)
    } catch (err: unknown) {
      const error = err as { code?: string }
      switch (error.code) {
        case 'GAME_NOT_FOUND':
          setJoinError('Game not found')
          break
        case 'GAME_ALREADY_STARTED':
          setJoinError('Game already started')
          break
        case 'CANNOT_JOIN_OWN_GAME':
          setJoinError("Can't join your own game")
          break
        default:
          setJoinError('Failed to join')
      }
    } finally {
      setJoiningGame(false)
    }
  }, [joinCode, navigate])

  const openPlayModal = () => {
    setPlayModalMode('choose')
    setJoinCode('')
    setJoinError(null)
    setShowPlayModal(true)
  }

  const closePlayModal = () => {
    setShowPlayModal(false)
    setPlayModalMode('choose')
    setJoinCode('')
    setJoinError(null)
  }

  const handlePlayOnline = () => {
    closePlayModal()
    setShowMatchmaking(true)
  }

  if (loading) {
    return (
      <div className="h-screen bg-gradient-to-b from-blue-600 via-blue-700 to-blue-800 flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-10 h-10 border-3 border-white border-t-transparent rounded-full animate-spin" />
          <span className="text-white/70 text-sm">Loading...</span>
        </div>
      </div>
    )
  }

  return (
    <div className="h-screen bg-gradient-to-b from-blue-600 via-blue-700 to-blue-800 flex flex-col overflow-hidden">
      {/* Minimal Header - Sign out only */}
      <header className="flex-shrink-0 flex items-center justify-end px-4 sm:px-6 py-3 sm:py-4">
        <div className="flex items-center gap-3">
          {profile && (
            <Link
              to="/history"
              className="text-white/70 hover:text-white transition-colors text-sm hidden sm:flex items-center gap-1.5"
            >
              <span className="font-medium">{profile.rating}</span>
              <span className="text-white/50">rating</span>
            </Link>
          )}
          <button
            onClick={signOut}
            className="text-white/70 hover:text-white transition-colors p-2 -m-2"
            title="Sign out"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"
              />
            </svg>
          </button>
        </div>
      </header>

      {/* Active Game Banner */}
      {activeGamePublicId && (
        <div className="px-4 sm:px-6">
          <div className="max-w-md mx-auto bg-white/10 backdrop-blur-sm border border-white/20 rounded-xl p-4 flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
              <span className="text-white/90 text-sm font-medium">You have an active game</span>
            </div>
            <button
              onClick={() => navigate(`/game/${activeGamePublicId}`)}
              className="bg-white text-blue-600 font-semibold px-4 py-2 rounded-lg text-sm hover:bg-white/90 transition-colors"
            >
              Resume
            </button>
          </div>
        </div>
      )}

      {/* Main Content - Board + CTAs */}
      <main className="flex-1 flex flex-col items-center justify-center px-4 sm:px-6 pb-6 min-h-0">
        {/* Title - Centered, stronger weight */}
        <h1 className="text-4xl sm:text-5xl font-extrabold text-white mb-6 sm:mb-8 tracking-tight text-center drop-shadow-lg">
          Connect 4
        </h1>

        {/* Game Board - The Visual Centerpiece (slightly smaller, stronger shadow) */}
        <div className="w-full max-w-sm sm:max-w-md flex-shrink-0 mb-8 sm:mb-10">
          <PreviewBoard className="w-full" />
        </div>

        {/* Action Button - Single Play Now CTA */}
        <div className="w-full max-w-xs sm:max-w-sm">
          <button
            onClick={openPlayModal}
            className="w-full bg-gradient-to-b from-white to-gray-100 text-blue-700 font-bold py-4 px-6 rounded-2xl hover:from-gray-50 hover:to-gray-150 transition-all duration-150 text-lg shadow-lg hover:shadow-xl active:translate-y-0.5 active:shadow-md flex items-center justify-center gap-2 border border-white/50"
            style={{ boxShadow: '0 4px 14px rgba(0,0,0,0.15), inset 0 1px 0 rgba(255,255,255,0.8)' }}
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z"
              />
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
            Play Now
          </button>
        </div>

        {/* Stats row - subtle, below buttons */}
        {profile && (
          <div className="mt-6 flex items-center gap-6 text-sm">
            <div className="flex items-center gap-1.5">
              <span className="text-green-300 font-semibold">{profile.wins}</span>
              <span className="text-white/50">W</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-red-300 font-semibold">{profile.losses}</span>
              <span className="text-white/50">L</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-white/70 font-semibold">{profile.draws}</span>
              <span className="text-white/50">D</span>
            </div>
            <Link
              to="/history"
              className="text-white/50 hover:text-white transition-colors ml-2"
            >
              View history
            </Link>
          </div>
        )}
      </main>

      {/* Matchmaking Modal */}
      {showMatchmaking && <MatchmakingModal onClose={() => setShowMatchmaking(false)} />}

      {/* Play Mode Modal */}
      {showPlayModal && (
        <div
          className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fade-in"
          onClick={(e) => e.target === e.currentTarget && closePlayModal()}
        >
          <div className="bg-white rounded-2xl shadow-2xl max-w-sm w-full p-6 animate-scale-in">
            {/* Initial choice: Play Online vs Play with Friend */}
            {playModalMode === 'choose' && (
              <>
                <h3 className="text-xl font-semibold text-gray-800 mb-6 text-center">
                  How do you want to play?
                </h3>
                <div className="space-y-3">
                  <button
                    onClick={handlePlayOnline}
                    className="w-full bg-blue-500 text-white font-medium py-4 px-4 rounded-xl hover:bg-blue-600 transition-all duration-200 flex items-center justify-center gap-2"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9"
                      />
                    </svg>
                    Play Online
                  </button>
                  <button
                    onClick={() => setPlayModalMode('friend-choose')}
                    className="w-full bg-gray-100 text-gray-700 font-medium py-4 px-4 rounded-xl hover:bg-gray-200 transition-all duration-200 flex items-center justify-center gap-2"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z"
                      />
                    </svg>
                    Play with Friend
                  </button>
                </div>
                <button
                  onClick={closePlayModal}
                  className="w-full mt-4 text-gray-400 hover:text-gray-600 text-sm py-2 transition-colors"
                >
                  Cancel
                </button>
              </>
            )}

            {/* Friend game: Create or Join */}
            {playModalMode === 'friend-choose' && (
              <>
                <button
                  onClick={() => setPlayModalMode('choose')}
                  className="text-gray-400 hover:text-gray-600 transition-colors mb-4 flex items-center gap-1 text-sm"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                  </svg>
                  Back
                </button>
                <h3 className="text-xl font-semibold text-gray-800 mb-6 text-center">
                  Play with Friend
                </h3>
                <div className="space-y-3">
                  <button
                    onClick={handleCreatePrivateGame}
                    disabled={creatingGame}
                    className="w-full bg-blue-500 text-white font-medium py-4 px-4 rounded-xl hover:bg-blue-600 transition-all duration-200 disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                    </svg>
                    {creatingGame ? 'Creating...' : 'Create Game'}
                  </button>
                  <button
                    onClick={() => setPlayModalMode('friend-join')}
                    className="w-full bg-gray-100 text-gray-700 font-medium py-4 px-4 rounded-xl hover:bg-gray-200 transition-all duration-200 flex items-center justify-center gap-2"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 16l-4-4m0 0l4-4m-4 4h14" />
                    </svg>
                    Join with Code
                  </button>
                </div>
              </>
            )}

            {/* Friend game: Enter code */}
            {playModalMode === 'friend-join' && (
              <>
                <button
                  onClick={() => setPlayModalMode('friend-choose')}
                  className="text-gray-400 hover:text-gray-600 transition-colors mb-4 flex items-center gap-1 text-sm"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                  </svg>
                  Back
                </button>
                <h3 className="text-xl font-semibold text-gray-800 mb-4 text-center">
                  Enter Game Code
                </h3>
                <input
                  type="text"
                  value={joinCode}
                  onChange={(e) => {
                    setJoinCode(e.target.value.toUpperCase())
                    setJoinError(null)
                  }}
                  placeholder="XXXXXX"
                  maxLength={6}
                  autoFocus
                  className="w-full px-4 py-4 text-center text-2xl font-mono tracking-[0.3em] bg-gray-50 border border-gray-300 rounded-xl focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none text-gray-800 placeholder-gray-400 mb-4"
                />
                {joinError && (
                  <p className="text-red-500 text-sm text-center mb-4">{joinError}</p>
                )}
                <button
                  onClick={handleJoinGame}
                  disabled={joiningGame || joinCode.length !== 6}
                  className="w-full py-4 px-4 rounded-xl font-medium bg-blue-500 hover:bg-blue-600 text-white transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {joiningGame ? 'Joining...' : 'Join Game'}
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

// Guest username generator
const ADJECTIVES = ['Swift', 'Clever', 'Bold', 'Quick', 'Bright', 'Keen', 'Lucky', 'Happy', 'Brave', 'Calm']
const NOUNS = ['Panda', 'Falcon', 'Tiger', 'Wolf', 'Eagle', 'Fox', 'Bear', 'Hawk', 'Lion', 'Lynx']

function generateGuestUsername(): string {
  const adj = ADJECTIVES[Math.floor(Math.random() * ADJECTIVES.length)]
  const noun = NOUNS[Math.floor(Math.random() * NOUNS.length)]
  const num = Math.floor(Math.random() * 1000)
  return `${adj}${noun}${num}`
}
