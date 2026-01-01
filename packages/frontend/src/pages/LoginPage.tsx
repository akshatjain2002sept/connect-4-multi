import { useNavigate } from 'react-router-dom'
import { useAuthContext } from '../contexts/AuthContext'
import { useState, useEffect } from 'react'
import { PreviewBoard } from '../components/PreviewBoard'
import { api, User } from '../lib/api'
import { MatchmakingModal } from '../components/MatchmakingModal'

type ModalStep = 'none' | 'auth' | 'play-choice' | 'friend-choose' | 'friend-join'

export function LoginPage() {
  const { user, loading, signInWithGoogle, signInAsGuest, signOut, error } = useAuthContext()
  const navigate = useNavigate()
  const [modalStep, setModalStep] = useState<ModalStep>('none')
  const [showMatchmaking, setShowMatchmaking] = useState(false)
  const [joinCode, setJoinCode] = useState('')
  const [joinError, setJoinError] = useState<string | null>(null)
  const [creatingGame, setCreatingGame] = useState(false)
  const [joiningGame, setJoiningGame] = useState(false)
  const [pendingAction, setPendingAction] = useState<'google' | 'guest' | null>(null)
  const [profile, setProfile] = useState<User | null>(null)
  const [initializingProfile, setInitializingProfile] = useState(false)

  // After successful auth, create user profile and show play choice
  useEffect(() => {
    if (user && !loading && pendingAction) {
      setInitializingProfile(true)
      // First, ensure user exists in backend by calling getMe
      api.getMe().then(userProfile => {
        setProfile(userProfile)
        setPendingAction(null)
        // Check for active game - only auto-redirect for ACTIVE games
        // Don't redirect for WAITING games - let user choose what to do
        return api.getActiveGame()
      }).then(activeGame => {
        setInitializingProfile(false)
        if (activeGame && activeGame.status === 'ACTIVE') {
          navigate(`/game/${activeGame.publicId}`)
        } else {
          setModalStep('play-choice')
        }
      }).catch(() => {
        setInitializingProfile(false)
        setPendingAction(null)
        setModalStep('play-choice')
      })
    }
  }, [user, loading, pendingAction, navigate])

  const handlePlayNow = () => {
    if (user) {
      // Already logged in, go straight to play choice
      // Only auto-redirect for ACTIVE games (gameplay in progress)
      // Don't redirect for WAITING games - let user choose what to do
      api.getActiveGame().then(activeGame => {
        if (activeGame && activeGame.status === 'ACTIVE') {
          navigate(`/game/${activeGame.publicId}`)
        } else {
          setModalStep('play-choice')
        }
      }).catch(() => {
        setModalStep('play-choice')
      })
    } else {
      setModalStep('auth')
    }
  }

  const handleGoogleSignIn = async () => {
    setPendingAction('google')
    await signInWithGoogle()
  }

  const handleGuestSignIn = async () => {
    setPendingAction('guest')
    await signInAsGuest()
  }

  const handlePlayOnline = () => {
    setModalStep('none')
    setShowMatchmaking(true)
  }

  const handleCreatePrivateGame = async () => {
    setCreatingGame(true)
    try {
      const game = await api.createPrivateGame()
      navigate(`/game/${game.publicId}`)
    } catch (err) {
      console.error('Failed to create game:', err)
    } finally {
      setCreatingGame(false)
    }
  }

  const handleJoinGame = async () => {
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
  }

  const closeModal = () => {
    setModalStep('none')
    setJoinCode('')
    setJoinError(null)
  }

  if ((loading && pendingAction) || initializingProfile) {
    return (
      <div className="h-screen bg-gradient-to-b from-blue-600 via-blue-700 to-blue-800 flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-10 h-10 border-3 border-white border-t-transparent rounded-full animate-spin" />
          <span className="text-white/70 text-sm">{initializingProfile ? 'Setting up...' : 'Signing in...'}</span>
        </div>
      </div>
    )
  }

  const handleSignOut = async () => {
    await signOut()
    setProfile(null)
    setModalStep('none')
  }

  const handleUpgradeToGoogle = async () => {
    // Sign out guest and sign in with Google
    await signOut()
    setProfile(null)
    setPendingAction('google')
    await signInWithGoogle()
  }

  return (
    <div className="h-screen bg-gradient-to-b from-blue-600 via-blue-700 to-blue-800 flex flex-col overflow-hidden">
      {/* Header with Sign Out when logged in */}
      {user && (
        <header className="flex-shrink-0 flex items-center justify-end px-4 sm:px-6 py-3 sm:py-4">
          <button
            onClick={handleSignOut}
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
        </header>
      )}

      {/* Main Content */}
      <main className="flex-1 flex flex-col items-center justify-center px-4 sm:px-6 pb-6 min-h-0">
        {/* Title */}
        <h1 className="text-3xl sm:text-4xl font-bold text-white mb-6 sm:mb-8 tracking-tight animate-fade-in">
          Connect 4
        </h1>

        {/* Preview Board */}
        <div className="w-full max-w-sm sm:max-w-md flex-shrink-0 mb-8 sm:mb-10 animate-slide-up">
          <PreviewBoard className="w-full opacity-80" />
        </div>

        {/* Play Now Button */}
        <div className="w-full max-w-xs animate-slide-up" style={{ animationDelay: '0.1s' }}>
          {error && (
            <div className="bg-red-500/10 border border-red-500/30 text-red-400 px-4 py-3 rounded-xl text-sm text-center mb-4">
              {error.message}
            </div>
          )}

          <button
            onClick={handlePlayNow}
            className="w-full bg-gradient-to-b from-white to-gray-100 text-blue-700 font-bold py-4 px-6 rounded-2xl hover:from-gray-50 hover:to-gray-150 transition-all duration-150 text-lg shadow-lg hover:shadow-xl active:translate-y-0.5 active:shadow-md border border-white/50"
            style={{ boxShadow: '0 4px 14px rgba(0,0,0,0.15), inset 0 1px 0 rgba(255,255,255,0.8)' }}
          >
            Play Now
          </button>
        </div>

        {/* Subtle note */}
        <p className="text-xs text-white/50 text-center mt-6 max-w-xs">
          Play instantly as a guest or sign in to save your progress
        </p>
      </main>

      {/* Auth Modal */}
      {modalStep === 'auth' && (
        <div
          className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fade-in"
          onClick={(e) => e.target === e.currentTarget && closeModal()}
        >
          <div className="bg-white rounded-2xl shadow-2xl max-w-sm w-full p-6 animate-scale-in">
            <h3 className="text-xl font-semibold text-gray-800 mb-6 text-center">
              Choose how to play
            </h3>
            <div className="space-y-3">
              <button
                onClick={handleGuestSignIn}
                className="w-full bg-blue-500 text-white font-medium py-4 px-4 rounded-xl hover:bg-blue-600 transition-all duration-200 flex items-center justify-center gap-2"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                Play as Guest
              </button>
              <button
                onClick={handleGoogleSignIn}
                className="w-full bg-white border border-gray-300 text-gray-700 font-medium py-4 px-4 rounded-xl hover:bg-gray-50 transition-all duration-200 flex items-center justify-center gap-3"
              >
                <svg className="w-5 h-5" viewBox="0 0 24 24">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                </svg>
                Sign in with Google
              </button>
            </div>
            <button
              onClick={closeModal}
              className="w-full mt-4 text-gray-400 hover:text-gray-600 text-sm py-2 transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Play Choice Modal */}
      {modalStep === 'play-choice' && (
        <div
          className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fade-in"
          onClick={(e) => e.target === e.currentTarget && closeModal()}
        >
          <div className="bg-white rounded-2xl shadow-2xl max-w-sm w-full p-6 animate-scale-in">
            <h3 className="text-xl font-semibold text-gray-800 mb-6 text-center">
              How do you want to play?
            </h3>
            <div className="space-y-3">
              <button
                onClick={handlePlayOnline}
                className="w-full bg-blue-500 text-white font-medium py-4 px-4 rounded-xl hover:bg-blue-600 transition-all duration-200 flex items-center justify-center gap-2"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" />
                </svg>
                Play Online
              </button>
              <button
                onClick={() => setModalStep('friend-choose')}
                className="w-full bg-gray-100 text-gray-700 font-medium py-4 px-4 rounded-xl hover:bg-gray-200 transition-all duration-200 flex items-center justify-center gap-2"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                Play with Friend
              </button>
            </div>

            {/* Sign in option for guests */}
            {profile?.isGuest && (
              <>
                <div className="flex items-center gap-3 my-4">
                  <div className="flex-1 h-px bg-gray-200" />
                  <span className="text-xs text-gray-400">or</span>
                  <div className="flex-1 h-px bg-gray-200" />
                </div>
                <button
                  onClick={handleUpgradeToGoogle}
                  className="w-full bg-white border border-gray-300 text-gray-700 font-medium py-3 px-4 rounded-xl hover:bg-gray-50 transition-all duration-200 flex items-center justify-center gap-3 text-sm"
                >
                  <svg className="w-4 h-4" viewBox="0 0 24 24">
                    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                  </svg>
                  Sign in to save progress
                </button>
              </>
            )}

            <button
              onClick={closeModal}
              className="w-full mt-4 text-gray-400 hover:text-gray-600 text-sm py-2 transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Friend Choice Modal */}
      {modalStep === 'friend-choose' && (
        <div
          className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fade-in"
          onClick={(e) => e.target === e.currentTarget && closeModal()}
        >
          <div className="bg-white rounded-2xl shadow-2xl max-w-sm w-full p-6 animate-scale-in">
            <button
              onClick={() => setModalStep('play-choice')}
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
                onClick={() => setModalStep('friend-join')}
                className="w-full bg-gray-100 text-gray-700 font-medium py-4 px-4 rounded-xl hover:bg-gray-200 transition-all duration-200 flex items-center justify-center gap-2"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 16l-4-4m0 0l4-4m-4 4h14" />
                </svg>
                Join with Code
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Join Game Modal */}
      {modalStep === 'friend-join' && (
        <div
          className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fade-in"
          onClick={(e) => e.target === e.currentTarget && closeModal()}
        >
          <div className="bg-white rounded-2xl shadow-2xl max-w-sm w-full p-6 animate-scale-in">
            <button
              onClick={() => setModalStep('friend-choose')}
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
          </div>
        </div>
      )}

      {/* Matchmaking Modal */}
      {showMatchmaking && <MatchmakingModal onClose={() => setShowMatchmaking(false)} />}
    </div>
  )
}
