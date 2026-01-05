import { initializeApp } from 'firebase/app'
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signInAnonymously as firebaseSignInAnonymously,
  signOut as firebaseSignOut,
  onAuthStateChanged as firebaseOnAuthStateChanged,
  User,
  Auth,
} from 'firebase/auth'

// Dev mode: bypass Firebase auth entirely
const DEV_MODE = import.meta.env.VITE_DEV_AUTH_BYPASS === 'true'

// Mock user for dev mode
interface MockUser {
  uid: string
  email: string | null
  isAnonymous: boolean
  getIdToken: () => Promise<string>
}

let mockUser: MockUser | null = null
let authStateListeners: ((user: MockUser | null) => void)[] = []

function createMockUser(uid: string, email: string | null = null): MockUser {
  // Ensure UID has dev- prefix for consistency with backend
  const normalizedUid = uid.startsWith('dev-') ? uid : `dev-${uid}`
  return {
    uid: normalizedUid,
    email,
    isAnonymous: !email,
    getIdToken: async () => normalizedUid,
  }
}

function notifyAuthStateListeners() {
  authStateListeners.forEach(listener => listener(mockUser))
}

// Real Firebase setup (only if not in dev mode)
let auth: Auth | null = null
let googleProvider: GoogleAuthProvider | null = null

if (!DEV_MODE) {
  const firebaseConfig = {
    apiKey: "AIzaSyCh3YDYu39J7ZoHBrqszYSBNjGHqB7CxaU",
    authDomain: "connect-4-multi.firebaseapp.com",
    projectId: "connect-4-multi",
    storageBucket: "connect-4-multi.firebasestorage.app",
    messagingSenderId: "955330347096",
    appId: "1:955330347096:web:7f59ba3148ec6df8a38a2d",
  }

  const app = initializeApp(firebaseConfig)
  auth = getAuth(app)
  googleProvider = new GoogleAuthProvider()
}

export async function signInWithGoogle(): Promise<User | MockUser> {
  if (DEV_MODE) {
    mockUser = createMockUser('dev-google-user', 'dev@example.com')
    notifyAuthStateListeners()
    return mockUser
  }
  const result = await signInWithPopup(auth!, googleProvider!)
  return result.user
}

export async function signInAnonymously(): Promise<User | MockUser> {
  if (DEV_MODE) {
    mockUser = createMockUser('dev-guest-' + Date.now())
    notifyAuthStateListeners()
    return mockUser
  }
  const result = await firebaseSignInAnonymously(auth!)
  return result.user
}

export async function signOut(): Promise<void> {
  if (DEV_MODE) {
    mockUser = null
    notifyAuthStateListeners()
    return
  }
  await firebaseSignOut(auth!)
}

export async function getIdToken(): Promise<string | null> {
  if (DEV_MODE) {
    return mockUser ? mockUser.uid : null
  }
  const user = auth!.currentUser
  if (!user) return null
  return user.getIdToken()
}

export function onAuthStateChanged(callback: (user: User | MockUser | null) => void): () => void {
  if (DEV_MODE) {
    authStateListeners.push(callback)
    // Call immediately with current state
    setTimeout(() => callback(mockUser), 0)
    return () => {
      authStateListeners = authStateListeners.filter(l => l !== callback)
    }
  }
  return firebaseOnAuthStateChanged(auth!, callback)
}

export { auth, type User }
