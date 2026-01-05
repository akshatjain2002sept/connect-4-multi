import { Request, Response, NextFunction } from 'express'
import admin from 'firebase-admin'

// Dev mode: skip Firebase auth and use mock user
const DEV_MODE = process.env.NODE_ENV === 'development' && process.env.DEV_AUTH_BYPASS === 'true'

// Initialize Firebase Admin (only once, skip in dev bypass mode)
if (!DEV_MODE && !admin.apps.length) {
  try {
    // Method 1: Use GOOGLE_APPLICATION_CREDENTIALS file path (standard)
    if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
      admin.initializeApp({
        projectId: process.env.FIREBASE_PROJECT_ID,
      })
      console.log('Firebase Admin initialized with service account file')
    }
    // Method 2: Use individual environment variables (cleaner than JSON blob)
    else if (process.env.FIREBASE_PRIVATE_KEY && process.env.FIREBASE_CLIENT_EMAIL) {
      const serviceAccount = {
        type: 'service_account',
        project_id: process.env.FIREBASE_PROJECT_ID,
        private_key: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
        client_email: process.env.FIREBASE_CLIENT_EMAIL,
      }

      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
        projectId: process.env.FIREBASE_PROJECT_ID,
      })
      console.log('Firebase Admin initialized with individual environment variables')
    }
    // Method 3: Project ID only (will try default credentials)
    else if (process.env.FIREBASE_PROJECT_ID) {
      admin.initializeApp({
        projectId: process.env.FIREBASE_PROJECT_ID,
      })
      console.log('Firebase Admin initialized with project ID only (using default credentials)')
    }
    // Method 4: Default credentials auto-discovery
    else {
      admin.initializeApp()
      console.log('Firebase Admin initialized with default credentials')
    }
  } catch (error) {
    console.error('Failed to initialize Firebase Admin:', error)
    console.log('Auth will use fallback mode - tokens will be rejected')
  }
}

export interface AuthenticatedUser {
  uid: string
  email?: string
  isAnonymous: boolean
}

export interface AuthenticatedRequest extends Request {
  user: AuthenticatedUser
}

/**
 * Firebase Auth middleware
 * Verifies the Firebase ID token from Authorization header
 * Attaches user info to request as req.user
 */
export async function authMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  // Dev bypass: accept any token as a user ID
  if (DEV_MODE) {
    const authHeader = req.headers.authorization
    // In dev mode, token format is "Bearer dev-{userId}" or just "Bearer {userId}"
    const token = authHeader?.startsWith('Bearer ') ? authHeader.substring(7) : 'dev-user-1'
    const uid = token.startsWith('dev-') ? token : `dev-${token}`
    // Detect guest users by uid pattern (dev-guest-*)
    const isGuest = uid.includes('guest')

    ;(req as AuthenticatedRequest).user = {
      uid,
      email: isGuest ? undefined : `${uid}@dev.local`,
      isAnonymous: isGuest,
    }
    next()
    return
  }

  const authHeader = req.headers.authorization

  if (!authHeader?.startsWith('Bearer ')) {
    res.status(401).json({ error: 'UNAUTHORIZED', message: 'Missing or invalid authorization header' })
    return
  }

  const idToken = authHeader.substring(7) // Remove 'Bearer ' prefix

  try {
    const decodedToken = await admin.auth().verifyIdToken(idToken)

    ;(req as AuthenticatedRequest).user = {
      uid: decodedToken.uid,
      email: decodedToken.email,
      isAnonymous: decodedToken.firebase?.sign_in_provider === 'anonymous',
    }

    next()
  } catch (error) {
    console.error('Auth error:', error)
    res.status(401).json({ error: 'UNAUTHORIZED', message: 'Invalid or expired token' })
  }
}

/**
 * Optional auth middleware - doesn't fail if no token provided
 * Useful for endpoints that work differently for authenticated vs anonymous users
 */
export async function optionalAuthMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  const authHeader = req.headers.authorization

  if (!authHeader?.startsWith('Bearer ')) {
    next()
    return
  }

  const idToken = authHeader.substring(7)

  try {
    const decodedToken = await admin.auth().verifyIdToken(idToken)

    ;(req as AuthenticatedRequest).user = {
      uid: decodedToken.uid,
      email: decodedToken.email,
      isAnonymous: decodedToken.firebase?.sign_in_provider === 'anonymous',
    }
  } catch {
    // Silently ignore invalid tokens for optional auth
  }

  next()
}
