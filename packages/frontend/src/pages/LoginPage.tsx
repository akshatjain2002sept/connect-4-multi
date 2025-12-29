import { useNavigate } from 'react-router-dom'
import { useAuthContext } from '../contexts/AuthContext'
import { useEffect } from 'react'
import { PreviewBoard } from '../components/PreviewBoard'

export function LoginPage() {
  const { user, loading, signInWithGoogle, signInAsGuest, error } = useAuthContext()
  const navigate = useNavigate()

  useEffect(() => {
    if (user && !loading) {
      navigate('/', { replace: true })
    }
  }, [user, loading, navigate])

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

        {/* Auth Buttons */}
        <div className="w-full max-w-xs space-y-3 animate-slide-up" style={{ animationDelay: '0.1s' }}>
          {error && (
            <div className="bg-red-500/10 border border-red-500/30 text-red-400 px-4 py-3 rounded-xl text-sm text-center mb-4">
              {error.message}
            </div>
          )}

          {/* Play as Guest - Primary CTA with tactile press */}
          <button
            onClick={signInAsGuest}
            className="w-full bg-gradient-to-b from-white to-gray-100 text-blue-700 font-bold py-4 px-6 rounded-2xl hover:from-gray-50 hover:to-gray-150 transition-all duration-150 text-lg shadow-lg hover:shadow-xl active:translate-y-0.5 active:shadow-md border border-white/50"
            style={{ boxShadow: '0 4px 14px rgba(0,0,0,0.15), inset 0 1px 0 rgba(255,255,255,0.8)' }}
          >
            Play Now
          </button>

          {/* Sign in with Google - Secondary, de-emphasized */}
          <button
            onClick={signInWithGoogle}
            className="w-full bg-white/10 text-white/80 font-medium py-3 px-6 rounded-xl hover:bg-white/20 hover:text-white transition-all duration-200 text-sm active:translate-y-0.5 flex items-center justify-center gap-3"
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24">
              <path
                fill="#4285F4"
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
              />
              <path
                fill="#34A853"
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
              />
              <path
                fill="#FBBC05"
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
              />
              <path
                fill="#EA4335"
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
              />
            </svg>
            Sign in with Google
          </button>
        </div>

        {/* Subtle note */}
        <p className="text-xs text-white/50 text-center mt-6 max-w-xs">
          Guest progress is saved in this browser only
        </p>
      </main>
    </div>
  )
}
