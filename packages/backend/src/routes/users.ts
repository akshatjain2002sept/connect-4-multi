import { Router, Response } from 'express'
import { prisma } from '../lib/db.js'
import { authMiddleware, AuthenticatedRequest } from '../middleware/auth.js'
import { ApiError } from '../lib/errors.js'

const router: ReturnType<typeof Router> = Router()

// Guest username generation
const ADJECTIVES = [
  'Swift', 'Clever', 'Bold', 'Quick', 'Bright', 'Keen', 'Lucky', 'Happy', 'Brave', 'Calm',
  'Eager', 'Fierce', 'Gentle', 'Honest', 'Jolly', 'Kind', 'Lively', 'Mighty', 'Noble', 'Proud',
  'Royal', 'Sharp', 'Smart', 'Steady', 'Strong', 'True', 'Warm', 'Wise', 'Young', 'Zesty'
]

const NOUNS = [
  'Panda', 'Falcon', 'Tiger', 'Wolf', 'Eagle', 'Fox', 'Bear', 'Hawk', 'Lion', 'Lynx',
  'Otter', 'Raven', 'Shark', 'Snake', 'Whale', 'Zebra', 'Dragon', 'Phoenix', 'Griffin', 'Unicorn',
  'Badger', 'Condor', 'Dolphin', 'Jaguar', 'Koala', 'Leopard', 'Mongoose', 'Panther', 'Sparrow', 'Viper'
]

function generateGuestUsername(): string {
  const adj = ADJECTIVES[Math.floor(Math.random() * ADJECTIVES.length)]
  const noun = NOUNS[Math.floor(Math.random() * NOUNS.length)]
  const num = Math.floor(Math.random() * 1000)
  return `${adj}${noun}${num}`
}

async function generateUniqueUsername(): Promise<string> {
  for (let attempt = 0; attempt < 10; attempt++) {
    const username = generateGuestUsername()
    const existing = await prisma.user.findUnique({ where: { username } })
    if (!existing) return username
  }
  // Fallback with more random numbers
  return `Guest${Date.now().toString(36)}${Math.random().toString(36).substring(2, 6)}`
}

/**
 * GET /api/users/me
 * Get current user profile. Creates user if doesn't exist.
 */
router.get('/me', authMiddleware, async (req, res: Response, next) => {
  try {
    const { uid, email, isAnonymous } = (req as AuthenticatedRequest).user

    let user = await prisma.user.findUnique({
      where: { firebaseUid: uid }
    })

    if (!user) {
      // Auto-create user on first access
      const username = await generateUniqueUsername()
      user = await prisma.user.create({
        data: {
          firebaseUid: uid,
          email: email || null,
          username,
          isGuest: isAnonymous,
        }
      })
    }

    res.json({
      id: user.id,
      username: user.username,
      email: user.email,
      isGuest: user.isGuest,
      rating: user.rating,
      wins: user.wins,
      losses: user.losses,
      draws: user.draws,
      createdAt: user.createdAt.toISOString(),
    })
  } catch (error) {
    next(error)
  }
})

/**
 * PUT /api/users/me
 * Update current user profile (username only for now)
 */
router.put('/me', authMiddleware, async (req, res: Response, next) => {
  try {
    const { uid } = (req as AuthenticatedRequest).user
    const { username } = req.body

    let user = await prisma.user.findUnique({
      where: { firebaseUid: uid }
    })

    if (!user) {
      throw new ApiError('USER_NOT_FOUND')
    }

    // Validate username if provided
    if (username !== undefined) {
      if (typeof username !== 'string') {
        throw new ApiError('INVALID_USERNAME', 'Username must be a string')
      }

      const trimmed = username.trim()
      if (trimmed.length < 3 || trimmed.length > 20) {
        throw new ApiError('INVALID_USERNAME', 'Username must be 3-20 characters')
      }

      if (!/^[a-zA-Z0-9_]+$/.test(trimmed)) {
        throw new ApiError('INVALID_USERNAME', 'Username can only contain letters, numbers, and underscores')
      }

      // Check if username is taken (by another user)
      if (trimmed !== user.username) {
        const existing = await prisma.user.findUnique({ where: { username: trimmed } })
        if (existing) {
          throw new ApiError('USERNAME_TAKEN', 'Username is already taken')
        }
      }

      user = await prisma.user.update({
        where: { id: user.id },
        data: { username: trimmed }
      })
    }

    res.json({
      id: user.id,
      username: user.username,
      email: user.email,
      isGuest: user.isGuest,
      rating: user.rating,
      wins: user.wins,
      losses: user.losses,
      draws: user.draws,
      createdAt: user.createdAt.toISOString(),
    })
  } catch (error) {
    next(error)
  }
})

/**
 * GET /api/users/me/active-game
 * Get user's current active or waiting game
 */
router.get('/me/active-game', authMiddleware, async (req, res: Response, next) => {
  try {
    const { uid } = (req as AuthenticatedRequest).user

    const user = await prisma.user.findUnique({
      where: { firebaseUid: uid }
    })

    if (!user) {
      throw new ApiError('USER_NOT_FOUND')
    }

    const activeGame = await prisma.game.findFirst({
      where: {
        OR: [{ player1Id: user.id }, { player2Id: user.id }],
        status: { in: ['WAITING', 'ACTIVE'] }
      },
      include: {
        player1: { select: { id: true, username: true, rating: true } },
        player2: { select: { id: true, username: true, rating: true } }
      }
    })

    if (!activeGame) {
      res.json({ activeGame: null })
      return
    }

    res.json({
      activeGame: {
        id: activeGame.id,
        publicId: activeGame.publicId,
        status: activeGame.status,
        currentTurn: activeGame.currentTurn,
        player1: activeGame.player1,
        player2: activeGame.player2,
      }
    })
  } catch (error) {
    next(error)
  }
})

/**
 * GET /api/users/me/games
 * Get user's game history
 */
router.get('/me/games', authMiddleware, async (req, res: Response, next) => {
  try {
    const { uid } = (req as AuthenticatedRequest).user
    const limit = Math.min(parseInt(req.query.limit as string) || 10, 50)
    const offset = parseInt(req.query.offset as string) || 0

    const user = await prisma.user.findUnique({
      where: { firebaseUid: uid }
    })

    if (!user) {
      throw new ApiError('USER_NOT_FOUND')
    }

    const [games, total] = await Promise.all([
      prisma.game.findMany({
        where: {
          OR: [{ player1Id: user.id }, { player2Id: user.id }],
          status: { in: ['COMPLETED', 'ABANDONED'] }
        },
        include: {
          player1: { select: { id: true, username: true, rating: true } },
          player2: { select: { id: true, username: true, rating: true } }
        },
        orderBy: { completedAt: 'desc' },
        take: limit,
        skip: offset
      }),
      prisma.game.count({
        where: {
          OR: [{ player1Id: user.id }, { player2Id: user.id }],
          status: { in: ['COMPLETED', 'ABANDONED'] }
        }
      })
    ])

    res.json({
      games: games.map(game => ({
        id: game.id,
        publicId: game.publicId,
        status: game.status,
        result: game.result,
        endedReason: game.endedReason,
        player1: game.player1,
        player2: game.player2,
        winnerId: game.winnerId,
        p1RatingDelta: game.p1RatingDelta,
        p2RatingDelta: game.p2RatingDelta,
        completedAt: game.completedAt?.toISOString()
      })),
      total,
      limit,
      offset
    })
  } catch (error) {
    next(error)
  }
})

export default router
