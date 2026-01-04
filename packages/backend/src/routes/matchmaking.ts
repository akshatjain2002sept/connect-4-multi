import { Router, Response } from 'express'
import { Mutex } from 'async-mutex'
import { prisma } from '../lib/db.js'
import { authMiddleware, AuthenticatedRequest } from '../middleware/auth.js'
import { ApiError } from '../lib/errors.js'
import { createGameWithPublicId, getActiveGameForUser } from '../lib/game.js'

const router: ReturnType<typeof Router> = Router()

// In-memory matchmaking queue (single instance required!)
const matchmakingMutex = new Mutex()

interface QueueEntry {
  userId: string
  username: string
  rating: number
  joinedAt: Date
  lastHeartbeat: Date
}

const matchmakingQueue: Map<string, QueueEntry> = new Map()

const QUEUE_STALE_THRESHOLD_MS = 30 * 1000

/**
 * Remove stale entries from the queue
 */
function cleanupStaleQueueEntries(): void {
  const now = Date.now()
  for (const [userId, entry] of matchmakingQueue) {
    if (now - entry.lastHeartbeat.getTime() > QUEUE_STALE_THRESHOLD_MS) {
      matchmakingQueue.delete(userId)
    }
  }
}

// Periodic cleanup
setInterval(() => {
  matchmakingMutex.runExclusive(() => cleanupStaleQueueEntries())
}, 10000)

/**
 * POST /api/matchmaking/join
 * Join the matchmaking queue
 */
router.post('/join', authMiddleware, async (req, res: Response, next) => {
  try {
    const { uid } = (req as AuthenticatedRequest).user

    const user = await prisma.user.findUnique({ where: { firebaseUid: uid } })
    if (!user) throw new ApiError('USER_NOT_FOUND')

    const result = await matchmakingMutex.runExclusive(async () => {
      // Already in queue?
      if (matchmakingQueue.has(user.id)) {
        return { status: 'already_queued' as const }
      }

      // Already in a game?
      const activeGame = await getActiveGameForUser(prisma, user.id)
      if (activeGame) {
        // If user has a WAITING game they created (no opponent yet), auto-cancel it
        // This allows joining matchmaking without manually canceling the old game
        if (activeGame.status === 'WAITING' && activeGame.player1Id === user.id && !activeGame.player2Id) {
          await prisma.game.update({
            where: { id: activeGame.id },
            data: { status: 'ABANDONED' }
          })
        } else {
          // User has an ACTIVE game or is player2 in a WAITING game
          return { status: 'has_active_game' as const, gameId: activeGame.id, publicId: activeGame.publicId }
        }
      }

      cleanupStaleQueueEntries()

      // Find match (FIFO)
      let matchedUserId: string | null = null
      let matchedEntry: QueueEntry | null = null

      for (const [id, entry] of matchmakingQueue) {
        if (id !== user.id) {
          matchedUserId = id
          matchedEntry = entry
          break
        }
      }

      if (matchedUserId && matchedEntry) {
        matchmakingQueue.delete(matchedUserId)

        // Verify matched user doesn't have an active game
        const matchedActiveGame = await getActiveGameForUser(prisma, matchedUserId)
        if (matchedActiveGame) {
          // Matched user is in a game, add current user to queue instead
          matchmakingQueue.set(user.id, {
            userId: user.id,
            username: user.username,
            rating: user.rating,
            joinedAt: new Date(),
            lastHeartbeat: new Date()
          })
          return { status: 'queued' as const }
        }

        // Create game
        const player1GoesFirst = Math.random() < 0.5
        const [p1Data, p2Data] = await Promise.all([
          prisma.user.findUnique({ where: { id: matchedUserId } }),
          prisma.user.findUnique({ where: { id: user.id } })
        ])

        const game = await createGameWithPublicId(prisma, {
          player1: { connect: { id: matchedUserId } },
          player2: { connect: { id: user.id } },
          status: 'ACTIVE',
          currentTurn: player1GoesFirst ? 1 : 2,
          p1RatingBefore: p1Data!.rating,
          p2RatingBefore: p2Data!.rating,
          player1LastSeen: new Date(),
          player2LastSeen: new Date()
        })

        return { status: 'matched' as const, gameId: game.id, publicId: game.publicId }
      }

      // No match, add to queue
      matchmakingQueue.set(user.id, {
        userId: user.id,
        username: user.username,
        rating: user.rating,
        joinedAt: new Date(),
        lastHeartbeat: new Date()
      })

      return { status: 'queued' as const }
    })

    // Return 200 for already_queued since user is effectively queued (idempotent)
    res.json(result)
  } catch (error) {
    next(error)
  }
})

/**
 * DELETE /api/matchmaking/leave
 * Leave the matchmaking queue
 */
router.delete('/leave', authMiddleware, async (req, res: Response, next) => {
  try {
    const { uid } = (req as AuthenticatedRequest).user

    const user = await prisma.user.findUnique({ where: { firebaseUid: uid } })
    if (!user) throw new ApiError('USER_NOT_FOUND')

    const result = await matchmakingMutex.runExclusive(async () => {
      if (matchmakingQueue.delete(user.id)) {
        return { status: 'left' as const }
      }
      return { status: 'not_queued' as const }
    })

    res.json(result)
  } catch (error) {
    next(error)
  }
})

/**
 * GET /api/matchmaking/status
 * Check queue status (also acts as heartbeat)
 */
router.get('/status', authMiddleware, async (req, res: Response, next) => {
  try {
    const { uid } = (req as AuthenticatedRequest).user

    const user = await prisma.user.findUnique({ where: { firebaseUid: uid } })
    if (!user) throw new ApiError('USER_NOT_FOUND')

    const result = await matchmakingMutex.runExclusive(async () => {
      const entry = matchmakingQueue.get(user.id)

      if (!entry) {
        // Not in queue - check if matched
        const activeGame = await getActiveGameForUser(prisma, user.id)
        if (activeGame?.status === 'ACTIVE') {
          return { status: 'matched' as const, gameId: activeGame.id, publicId: activeGame.publicId }
        }
        return { status: 'not_queued' as const }
      }

      // Update heartbeat
      entry.lastHeartbeat = new Date()
      cleanupStaleQueueEntries()

      return { status: 'queued' as const, queuedAt: entry.joinedAt.toISOString() }
    })

    res.json(result)
  } catch (error) {
    next(error)
  }
})

export default router
