import { useState, useEffect, useCallback } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useAuthContext } from '../contexts/AuthContext'
import { api, User } from '../lib/api'
import { MatchmakingModal } from '../components/MatchmakingModal'
import { PreviewBoard } from '../components/PreviewBoard'

export function HomePage() {
  const { user, signOut, getIdToken } = useAuthContext()
  const navigate = useNavigate()
  const [profile, setProfile] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const [showMatchmaking, setShowMatchmaking] = useState(false)
  const [joinCode, setJoinCode] = useState('')
  const [joinError, setJoinError] = useState<string | null>(null)
  const [showFriendModal, setShowFriendModal] = useState(false)
  const [friendModalMode, setFriendModalMode] = useState<'choose' | 'create' | 'join'>('choose')
  const [creatingGame, setCreatingGame] = useState(false)
  const [joiningGame, setJoiningGame] = useState(false)

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

        const activeGame = await api.getActiveGame()
        if (activeGame) {
          navigate(`/game/${activeGame.publicId}`)
        }
      } catch (err) {
        console.error('Failed to initialize profile:', err)
      } finally {
        setLoading(false)
      }
    }

    initProfile()
  }, [user, getIdToken, navigate])

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

  const openFriendModal = () => {
    setFriendModalMode('choose')
    setJoinCode('')
    setJoinError(null)
    setShowFriendModal(true)
  }

  const closeFriendModal = () => {
    setShowFriendModal(false)
    setFriendModalMode('choose')
    setJoinCode('')
    setJoinError(null)
  }

  if (loading) {
    return (
      <div className="h-screen bg-gradient-to-b from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-10 h-10 border-3 border-blue-400 border-t-transparent rounded-full animate-spin" />
          <span className="text-slate-400 text-sm">Loading...</span>
        </div>
      </div>
    )
  }

  return (
    <div className="h-screen bg-gradient-to-b from-slate-900 via-slate-800 to-slate-900 flex flex-col overflow-hidden">
      {/* Minimal Header */}
      <header className="flex-shrink-0 flex items-center justify-between px-4 sm:px-6 py-3 sm:py-4">
        <h1 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
          Connect 4
        </h1>
        <div className="flex items-center gap-3">
          {profile && (
            <Link
              to="/history"
              className="text-slate-400 hover:text-white transition-colors text-sm hidden sm:flex items-center gap-1.5"
            >
              <span className="font-medium">{profile.rating}</span>
              <span className="text-slate-500">rating</span>
            </Link>
          )}
          <button
            onClick={signOut}
            className="text-slate-400 hover:text-white transition-colors p-2 -m-2"
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

      {/* Main Content - Board + CTAs */}
      <main className="flex-1 flex flex-col items-center justify-center px-4 sm:px-6 pb-6 min-h-0">
        {/* Game Board - The Visual Centerpiece */}
        <div className="w-full max-w-md sm:max-w-lg flex-shrink-0 mb-6 sm:mb-8">
          <PreviewBoard className="w-full" />
        </div>

        {/* Action Buttons */}
        <div className="w-full max-w-xs sm:max-w-sm space-y-3">
          {/* Primary CTA: New Game */}
          <button
            onClick={() => setShowMatchmaking(true)}
            className="w-full bg-gradient-to-r from-emerald-500 to-emerald-600 text-white font-semibold py-4 px-6 rounded-2xl hover:from-emerald-400 hover:to-emerald-500 transition-all duration-200 text-lg shadow-lg shadow-emerald-500/25 hover:shadow-xl hover:shadow-emerald-500/30 active:scale-[0.98] flex items-center justify-center gap-2"
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
            New Game
          </button>

          {/* Secondary CTA: Play with Friend */}
          <button
            onClick={openFriendModal}
            className="w-full bg-slate-700/50 text-slate-200 font-medium py-3.5 px-6 rounded-2xl hover:bg-slate-700 transition-all duration-200 text-base border border-slate-600/50 hover:border-slate-500/50 active:scale-[0.98] flex items-center justify-center gap-2"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"
              />
            </svg>
            Play with Friend
          </button>
        </div>

        {/* Stats row - subtle, below buttons */}
        {profile && (
          <div className="mt-6 flex items-center gap-6 text-sm">
            <div className="flex items-center gap-1.5">
              <span className="text-emerald-400 font-semibold">{profile.wins}</span>
              <span className="text-slate-500">W</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-red-400 font-semibold">{profile.losses}</span>
              <span className="text-slate-500">L</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-slate-400 font-semibold">{profile.draws}</span>
              <span className="text-slate-500">D</span>
            </div>
            <Link
              to="/history"
              className="text-slate-500 hover:text-slate-300 transition-colors ml-2"
            >
              View history
            </Link>
          </div>
        )}
      </main>

      {/* Matchmaking Modal */}
      {showMatchmaking && <MatchmakingModal onClose={() => setShowMatchmaking(false)} />}

      {/* Friend Game Modal */}
      {showFriendModal && (
        <div
          className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fade-in"
          onClick={(e) => e.target === e.currentTarget && closeFriendModal()}
        >
          <div className="bg-slate-800 rounded-2xl shadow-2xl max-w-sm w-full p-6 animate-scale-in border border-slate-700/50">
            {friendModalMode === 'choose' && (
              <>
                <h3 className="text-xl font-semibold text-white mb-6 text-center">
                  Play with Friend
                </h3>
                <div className="space-y-3">
                  <button
                    onClick={() => {
                      setFriendModalMode('create')
                      handleCreatePrivateGame()
                    }}
                    disabled={creatingGame}
                    className="w-full bg-gradient-to-r from-blue-500 to-blue-600 text-white font-medium py-4 px-4 rounded-xl hover:from-blue-400 hover:to-blue-500 transition-all duration-200 disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M12 4v16m8-8H4"
                      />
                    </svg>
                    {creatingGame ? 'Creating...' : 'Create Game'}
                  </button>
                  <button
                    onClick={() => setFriendModalMode('join')}
                    className="w-full bg-slate-700/50 text-slate-200 font-medium py-4 px-4 rounded-xl hover:bg-slate-700 transition-all duration-200 border border-slate-600/50 flex items-center justify-center gap-2"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M11 16l-4-4m0 0l4-4m-4 4h14"
                      />
                    </svg>
                    Join with Code
                  </button>
                </div>
                <button
                  onClick={closeFriendModal}
                  className="w-full mt-4 text-slate-500 hover:text-slate-300 text-sm py-2 transition-colors"
                >
                  Cancel
                </button>
              </>
            )}

            {friendModalMode === 'join' && (
              <>
                <button
                  onClick={() => setFriendModalMode('choose')}
                  className="text-slate-500 hover:text-white transition-colors mb-4 flex items-center gap-1 text-sm"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M15 19l-7-7 7-7"
                    />
                  </svg>
                  Back
                </button>
                <h3 className="text-xl font-semibold text-white mb-4 text-center">
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
                  className="w-full px-4 py-4 text-center text-2xl font-mono tracking-[0.3em] bg-slate-900/50 border border-slate-600 rounded-xl focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none text-white placeholder-slate-600 mb-4"
                />
                {joinError && (
                  <p className="text-red-400 text-sm text-center mb-4">{joinError}</p>
                )}
                <button
                  onClick={handleJoinGame}
                  disabled={joiningGame || joinCode.length !== 6}
                  className="w-full py-4 px-4 rounded-xl font-medium bg-blue-500 hover:bg-blue-400 text-white transition-all disabled:opacity-50 disabled:cursor-not-allowed"
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
