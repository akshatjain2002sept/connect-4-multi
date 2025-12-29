import { useState, useEffect, useCallback } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useAuthContext } from '../contexts/AuthContext'
import { api, User, Game } from '../lib/api'
import { MatchmakingModal } from '../components/MatchmakingModal'

export function HomePage() {
  const { user, signOut, getIdToken } = useAuthContext()
  const navigate = useNavigate()
  const [profile, setProfile] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const [showMatchmaking, setShowMatchmaking] = useState(false)
  const [joinCode, setJoinCode] = useState('')
  const [joinError, setJoinError] = useState<string | null>(null)
  const [showJoinModal, setShowJoinModal] = useState(false)
  const [creatingGame, setCreatingGame] = useState(false)
  const [joiningGame, setJoiningGame] = useState(false)

  // Fetch or create user profile
  useEffect(() => {
    const initProfile = async () => {
      if (!user) return

      try {
        // Ensure we have a token
        await getIdToken()

        // Try to get existing profile
        try {
          const existingProfile = await api.getMe()
          setProfile(existingProfile)
        } catch (err: unknown) {
          // Profile doesn't exist, create it
          const newProfile = await api.updateMe({
            username: user.displayName || generateGuestUsername(),
          })
          setProfile(newProfile)
        }

        // Check for active game
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
          setJoinError('Game not found. Check the code and try again.')
          break
        case 'GAME_ALREADY_STARTED':
          setJoinError('This game has already started.')
          break
        case 'CANNOT_JOIN_OWN_GAME':
          setJoinError("You can't join your own game!")
          break
        default:
          setJoinError('Failed to join game. Please try again.')
      }
    } finally {
      setJoiningGame(false)
    }
  }, [joinCode, navigate])

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-blue-500 to-blue-700 flex items-center justify-center">
        <div className="text-white text-xl">Loading...</div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-500 to-blue-700">
      <div className="container mx-auto px-3 sm:px-4 py-4 sm:py-8">
        {/* Header */}
        <div className="flex justify-between items-center mb-4 sm:mb-8">
          <h1 className="text-2xl sm:text-3xl font-bold text-white">Connect 4</h1>
          <div className="flex items-center gap-2 sm:gap-4">
            <span className="text-white text-sm sm:text-base truncate max-w-[100px] sm:max-w-none">
              {profile?.username || (user?.isAnonymous ? 'Guest' : user?.displayName)}
            </span>
            <button
              onClick={signOut}
              className="bg-white/20 text-white px-3 py-1.5 sm:px-4 sm:py-2 rounded-lg hover:bg-white/30 transition text-sm sm:text-base min-h-[44px]"
            >
              Sign Out
            </button>
          </div>
        </div>

        {/* Main Card */}
        <div className="bg-white rounded-xl sm:rounded-2xl shadow-2xl p-4 sm:p-8 max-w-2xl mx-auto">
          <h2 className="text-2xl font-bold text-gray-800 mb-6 text-center">Play Connect 4</h2>

          <div className="space-y-4">
            <button
              onClick={() => setShowMatchmaking(true)}
              className="w-full bg-gradient-to-r from-blue-500 to-blue-600 text-white font-semibold py-4 px-6 rounded-xl hover:from-blue-600 hover:to-blue-700 transition-all duration-200 text-lg flex items-center justify-center gap-2 shadow-lg hover:shadow-xl hover:scale-[1.02] active:scale-[0.98]"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                />
              </svg>
              Find Match
            </button>

            <button
              onClick={handleCreatePrivateGame}
              disabled={creatingGame}
              className="w-full bg-gradient-to-r from-green-500 to-green-600 text-white font-semibold py-4 px-6 rounded-xl hover:from-green-600 hover:to-green-700 transition-all duration-200 text-lg flex items-center justify-center gap-2 disabled:opacity-50 shadow-lg hover:shadow-xl hover:scale-[1.02] active:scale-[0.98]"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 4v16m8-8H4"
                />
              </svg>
              {creatingGame ? 'Creating...' : 'Create Private Game'}
            </button>

            <button
              onClick={() => setShowJoinModal(true)}
              className="w-full bg-gradient-to-r from-purple-500 to-purple-600 text-white font-semibold py-4 px-6 rounded-xl hover:from-purple-600 hover:to-purple-700 transition-all duration-200 text-lg flex items-center justify-center gap-2 shadow-lg hover:shadow-xl hover:scale-[1.02] active:scale-[0.98]"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h7a3 3 0 013 3v1"
                />
              </svg>
              Join with Code
            </button>
          </div>

          {/* Stats */}
          {profile && (
            <div className="mt-6 sm:mt-8 pt-6 sm:pt-8 border-t border-gray-200">
              <h3 className="text-base sm:text-lg font-semibold text-gray-700 mb-3 sm:mb-4">Your Stats</h3>
              <div className="grid grid-cols-4 gap-2 sm:gap-4 text-center">
                <div>
                  <div className="text-lg sm:text-2xl font-bold text-gray-800">{profile.rating}</div>
                  <div className="text-xs sm:text-sm text-gray-500">Rating</div>
                </div>
                <div>
                  <div className="text-lg sm:text-2xl font-bold text-green-600">{profile.wins}</div>
                  <div className="text-xs sm:text-sm text-gray-500">Wins</div>
                </div>
                <div>
                  <div className="text-lg sm:text-2xl font-bold text-red-600">{profile.losses}</div>
                  <div className="text-xs sm:text-sm text-gray-500">Losses</div>
                </div>
                <div>
                  <div className="text-lg sm:text-2xl font-bold text-gray-600">{profile.draws}</div>
                  <div className="text-xs sm:text-sm text-gray-500">Draws</div>
                </div>
              </div>
              <Link
                to="/history"
                className="block mt-4 text-center text-blue-500 hover:text-blue-600 font-medium text-sm sm:text-base min-h-[44px] flex items-center justify-center"
              >
                View Match History →
              </Link>
            </div>
          )}
        </div>
      </div>

      {/* Matchmaking Modal */}
      {showMatchmaking && <MatchmakingModal onClose={() => setShowMatchmaking(false)} />}

      {/* Join Game Modal */}
      {showJoinModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 animate-fade-in">
          <div className="bg-white rounded-2xl shadow-2xl max-w-sm w-full p-6 animate-scale-in">
            <h3 className="text-xl font-bold text-gray-800 mb-4">Join Game</h3>
            <input
              type="text"
              value={joinCode}
              onChange={(e) => {
                setJoinCode(e.target.value.toUpperCase())
                setJoinError(null)
              }}
              placeholder="Enter 6-character code"
              maxLength={6}
              className="w-full px-4 py-3 text-center text-2xl font-mono tracking-widest border-2 border-gray-300 rounded-xl focus:border-blue-500 focus:outline-none mb-4"
            />
            {joinError && (
              <p className="text-red-500 text-sm text-center mb-4">{joinError}</p>
            )}
            <div className="space-y-3">
              <button
                onClick={handleJoinGame}
                disabled={joiningGame || joinCode.length !== 6}
                className="w-full py-3 px-4 rounded-xl font-semibold bg-blue-500 hover:bg-blue-600 text-white transition disabled:opacity-50"
              >
                {joiningGame ? 'Joining...' : 'Join Game'}
              </button>
              <button
                onClick={() => {
                  setShowJoinModal(false)
                  setJoinCode('')
                  setJoinError(null)
                }}
                className="w-full py-3 px-4 rounded-xl font-semibold bg-gray-200 hover:bg-gray-300 text-gray-700 transition"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// Guest username generator (matches spec)
const ADJECTIVES = [
  'Swift',
  'Clever',
  'Bold',
  'Quick',
  'Bright',
  'Keen',
  'Lucky',
  'Happy',
  'Brave',
  'Calm',
]
const NOUNS = [
  'Panda',
  'Falcon',
  'Tiger',
  'Wolf',
  'Eagle',
  'Fox',
  'Bear',
  'Hawk',
  'Lion',
  'Lynx',
]

function generateGuestUsername(): string {
  const adj = ADJECTIVES[Math.floor(Math.random() * ADJECTIVES.length)]
  const noun = NOUNS[Math.floor(Math.random() * NOUNS.length)]
  const num = Math.floor(Math.random() * 1000)
  return `${adj}${noun}${num}`
}
