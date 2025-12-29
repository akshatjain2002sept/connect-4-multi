import { useState, useEffect, useCallback } from 'react'
import {
  auth,
  signInWithGoogle,
  signInAnonymously,
  signOut,
  getIdToken,
  onAuthStateChanged,
  User,
} from '../lib/firebase'

export interface AuthState {
  user: User | null
  loading: boolean
  error: Error | null
}

export interface AuthActions {
  signInWithGoogle: () => Promise<void>
  signInAsGuest: () => Promise<void>
  signOut: () => Promise<void>
  getIdToken: () => Promise<string | null>
}

export function useAuth(): AuthState & AuthActions {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setUser(user)
      setLoading(false)
    })

    return () => unsubscribe()
  }, [])

  const handleSignInWithGoogle = useCallback(async () => {
    setError(null)
    setLoading(true)
    try {
      await signInWithGoogle()
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to sign in with Google'))
    } finally {
      setLoading(false)
    }
  }, [])

  const handleSignInAsGuest = useCallback(async () => {
    setError(null)
    setLoading(true)
    try {
      await signInAnonymously()
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to sign in as guest'))
    } finally {
      setLoading(false)
    }
  }, [])

  const handleSignOut = useCallback(async () => {
    setError(null)
    try {
      await signOut()
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to sign out'))
    }
  }, [])

  const handleGetIdToken = useCallback(async () => {
    return getIdToken()
  }, [])

  return {
    user,
    loading,
    error,
    signInWithGoogle: handleSignInWithGoogle,
    signInAsGuest: handleSignInAsGuest,
    signOut: handleSignOut,
    getIdToken: handleGetIdToken,
  }
}
