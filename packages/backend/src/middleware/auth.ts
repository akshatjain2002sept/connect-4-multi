import { Request, Response, NextFunction } from 'express'
import admin from 'firebase-admin'

// Dev mode: skip Firebase auth and use mock user
const DEV_MODE = process.env.NODE_ENV === 'development' && process.env.DEV_AUTH_BYPASS === 'true'

// Initialize Firebase Admin (only once, skip in dev bypass mode)
if (!DEV_MODE && !admin.apps.length) {
  // In production, use GOOGLE_APPLICATION_CREDENTIALS env var
  // For development, initialize with project config
  const projectId = process.env.FIREBASE_PROJECT_ID

  if (projectId) {
    admin.initializeApp({
      projectId,
    })
  } else {
    // Fallback: try default credentials
    admin.initializeApp()
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

    ;(req as AuthenticatedRequest).user = {
      uid,
      email: `${uid}@dev.local`,
      isAnonymous: false,
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
