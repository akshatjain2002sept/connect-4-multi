import { Router, Response } from 'express'
import { Prisma } from '@prisma/client'
import { prisma } from '../lib/db.js'
import { authMiddleware, AuthenticatedRequest } from '../middleware/auth.js'
import { ApiError } from '../lib/errors.js'
import {
  createGameWithPublicId,
  generateGameCode,
  getActiveGameForUser,
  applyMove,
  checkWin,
  isBoardFull,
  parseMoves,
  calculateEloChange,
  calculateEloDraw,
  checkAbandonment
} from '../lib/game.js'
import { Move, GameResult, EndReason } from '@connect4/shared'

const router: ReturnType<typeof Router> = Router()

// Helper to format game response
function formatGameResponse(game: any) {
  return {
    id: game.id,
    publicId: game.publicId,
    code: game.code,
    status: game.status,
    board: game.board,
    currentTurn: game.currentTurn,
    moves: parseMoves(game.moves),
    player1: game.player1 ? {
      id: game.player1.id,
      firebaseUid: game.player1.firebaseUid,
      username: game.player1.username,
      rating: game.player1.rating
    } : null,
    player2: game.player2 ? {
      id: game.player2.id,
      firebaseUid: game.player2.firebaseUid,
      username: game.player2.username,
      rating: game.player2.rating
    } : null,
    result: game.result,
    endedReason: game.endedReason,
    winnerId: game.winnerId,
    p1RatingBefore: game.p1RatingBefore,
    p2RatingBefore: game.p2RatingBefore,
    p1RatingDelta: game.p1RatingDelta,
    p2RatingDelta: game.p2RatingDelta,
    player1LastSeen: game.player1LastSeen?.toISOString() ?? null,
    player2LastSeen: game.player2LastSeen?.toISOString() ?? null,
    rematchRequestedBy: game.rematchRequestedBy,
    rematchGameId: game.rematchGameId,
    // Include rematch game's public ID for navigation
    rematchPublicId: game.rematchGame?.publicId ?? null,
    createdAt: game.createdAt.toISOString(),
    updatedAt: game.updatedAt.toISOString(),
    completedAt: game.completedAt?.toISOString() ?? null
  }
}

/**
 * POST /api/games
 * Create a private game
 */
router.post('/', authMiddleware, async (req, res: Response, next) => {
  try {
    const { uid } = (req as AuthenticatedRequest).user

    const user = await prisma.user.findUnique({ where: { firebaseUid: uid } })
    if (!user) throw new ApiError('USER_NOT_FOUND')

    // Check for active game
    const activeGame = await getActiveGameForUser(prisma, user.id)
    if (activeGame) {
      // If user has a WAITING game they created (no opponent yet), auto-cancel it
      // This allows creating a new game without manually canceling the old one
      if (activeGame.status === 'WAITING' && activeGame.player1Id === user.id && !activeGame.player2Id) {
        await prisma.game.update({
          where: { id: activeGame.id },
          data: { status: 'ABANDONED' }
        })
      } else {
        // User has an ACTIVE game or is player2 in a WAITING game - can't create new
        throw new ApiError('HAS_ACTIVE_GAME')
      }
    }

    // Generate unique game code with retry
    let game = null
    for (let attempt = 0; attempt < 5; attempt++) {
      const code = generateGameCode()
      try {
        game = await createGameWithPublicId(prisma, {
          player1: { connect: { id: user.id } },
          code,
          status: 'WAITING',
          player1LastSeen: new Date()
        })
        break
      } catch (e: unknown) {
        const error = e as { code?: string; meta?: { target?: string[] } }
        if (error.code === 'P2002' && error.meta?.target?.includes('code')) continue
        throw e
      }
    }

    if (!game) throw new Error('Failed to generate unique game code')

    const fullGame = await prisma.game.findUnique({
      where: { id: game.id },
      include: {
        player1: { select: { id: true, firebaseUid: true, username: true, rating: true } },
        player2: { select: { id: true, firebaseUid: true, username: true, rating: true } }
      }
    })

    res.status(201).json(formatGameResponse(fullGame))
  } catch (error) {
    next(error)
  }
})

/**
 * POST /api/games/join/:code
 * Join a private game by code
 */
router.post('/join/:code', authMiddleware, async (req, res: Response, next) => {
  try {
    const { uid } = (req as AuthenticatedRequest).user
    const { code } = req.params

    // Validate code format
    if (!/^[A-HJ-NP-Z2-9]{6}$/i.test(code)) {
      throw new ApiError('INVALID_CODE_FORMAT')
    }

    const user = await prisma.user.findUnique({ where: { firebaseUid: uid } })
    if (!user) throw new ApiError('USER_NOT_FOUND')

    // Check for active game
    const activeGame = await getActiveGameForUser(prisma, user.id)
    if (activeGame) {
      // If user has a WAITING game they created (no opponent yet), auto-cancel it
      // This allows joining a new game without manually canceling the old one
      if (activeGame.status === 'WAITING' && activeGame.player1Id === user.id && !activeGame.player2Id) {
        await prisma.game.update({
          where: { id: activeGame.id },
          data: { status: 'ABANDONED' }
        })
      } else {
        // User has an ACTIVE game or is player2 in a WAITING game - can't join new
        throw new ApiError('HAS_ACTIVE_GAME')
      }
    }

    const result = await prisma.$transaction(async (tx) => {
      const game = await tx.game.findUnique({
        where: { code: code.toUpperCase() },
        include: { player1: true }
      })

      if (!game) throw new ApiError('GAME_NOT_FOUND')
      if (game.status !== 'WAITING') throw new ApiError('GAME_ALREADY_STARTED')
      if (game.player2Id !== null) throw new ApiError('GAME_ALREADY_STARTED')
      if (game.player1Id === user.id) throw new ApiError('CANNOT_JOIN_OWN_GAME')

      const joiningPlayer = await tx.user.findUnique({ where: { id: user.id } })
      if (!joiningPlayer) throw new ApiError('USER_NOT_FOUND')

      // Randomly decide who goes first
      const player1GoesFirst = Math.random() < 0.5

      const updateResult = await tx.game.updateMany({
        where: {
          id: game.id,
          status: 'WAITING',
          player2Id: null
        },
        data: {
          player2Id: user.id,
          status: 'ACTIVE',
          currentTurn: player1GoesFirst ? 1 : 2,
          p1RatingBefore: game.player1.rating,
          p2RatingBefore: joiningPlayer.rating,
          player1LastSeen: new Date(),
          player2LastSeen: new Date()
        }
      })

      if (updateResult.count !== 1) {
        throw new ApiError('GAME_ALREADY_STARTED')
      }

      const updatedGame = await tx.game.findUnique({
        where: { id: game.id },
        include: {
          player1: { select: { id: true, firebaseUid: true, username: true, rating: true } },
          player2: { select: { id: true, firebaseUid: true, username: true, rating: true } }
        }
      })

      // Assert snapshots were set
      if (updatedGame!.p1RatingBefore === null || updatedGame!.p2RatingBefore === null) {
        throw new Error('FATAL: Rating snapshots not set')
      }

      return updatedGame!
    })

    res.json(formatGameResponse(result))
  } catch (error) {
    next(error)
  }
})

/**
 * GET /api/games/by-public/:publicId
 * Get game by public ID (updates heartbeat)
 */
router.get('/by-public/:publicId', authMiddleware, async (req, res: Response, next) => {
  try {
    const { uid } = (req as AuthenticatedRequest).user
    const { publicId } = req.params

    const user = await prisma.user.findUnique({ where: { firebaseUid: uid } })
    if (!user) throw new ApiError('USER_NOT_FOUND')

    const game = await prisma.game.findUnique({
      where: { publicId },
      include: {
        player1: { select: { id: true, firebaseUid: true, username: true, rating: true } },
        player2: { select: { id: true, firebaseUid: true, username: true, rating: true } },
        rematchGame: { select: { publicId: true } }
      }
    })

    if (!game) throw new ApiError('GAME_NOT_FOUND')

    // Update heartbeat for any active player in WAITING or ACTIVE games
    if (game.status === 'WAITING' || game.status === 'ACTIVE') {
      if (game.player1Id === user.id) {
        await prisma.game.update({
          where: { id: game.id },
          data: { player1LastSeen: new Date() }
        })
      } else if (game.player2Id === user.id) {
        await prisma.game.update({
          where: { id: game.id },
          data: { player2LastSeen: new Date() }
        })
      }
    }

    res.json(formatGameResponse(game))
  } catch (error) {
    next(error)
  }
})

/**
 * GET /api/games/:id
 * Get game by ID
 */
router.get('/:id', authMiddleware, async (req, res: Response, next) => {
  try {
    const { id } = req.params

    const game = await prisma.game.findUnique({
      where: { id },
      include: {
        player1: { select: { id: true, firebaseUid: true, username: true, rating: true } },
        player2: { select: { id: true, firebaseUid: true, username: true, rating: true } },
        rematchGame: { select: { publicId: true } }
      }
    })

    if (!game) throw new ApiError('GAME_NOT_FOUND')

    res.json(formatGameResponse(game))
  } catch (error) {
    next(error)
  }
})

/**
 * POST /api/games/:id/move
 * Make a move in a game
 */
router.post('/:id/move', authMiddleware, async (req, res: Response, next) => {
  try {
    const { uid } = (req as AuthenticatedRequest).user
    const { id: gameId } = req.params
    const { column } = req.body

    if (typeof column !== 'number' || column < 0 || column > 6) {
      throw new ApiError('INVALID_COLUMN')
    }

    const user = await prisma.user.findUnique({ where: { firebaseUid: uid } })
    if (!user) throw new ApiError('USER_NOT_FOUND')

    const result = await prisma.$transaction(async (tx) => {
      const game = await tx.game.findUnique({ where: { id: gameId } })

      if (!game) throw new ApiError('GAME_NOT_FOUND')
      if (game.status !== 'ACTIVE') throw new ApiError('GAME_NOT_ACTIVE')
      if (!game.player2Id) throw new ApiError('GAME_NOT_STARTED')

      // Determine player
      const isPlayer1 = user.id === game.player1Id
      const isPlayer2 = user.id === game.player2Id
      if (!isPlayer1 && !isPlayer2) throw new ApiError('NOT_IN_GAME')
      const playerNumber = isPlayer1 ? 1 : 2

      // Check abandonment BEFORE turn validation
      if (checkAbandonment(game, user.id) === 'opponent_abandoned') {
        throw new ApiError('USE_CLAIM_ABANDONED_ENDPOINT')
      }

      // Validate turn
      if (game.currentTurn !== playerNumber) {
        throw new ApiError('NOT_YOUR_TURN')
      }

      // Apply move
      const moveResult = applyMove(game.board, column, playerNumber as 1 | 2)
      if (!moveResult) throw new ApiError('COLUMN_FULL')

      const { newBoard, row } = moveResult
      const moves = parseMoves(game.moves)
      const newMove: Move = {
        moveNumber: moves.length + 1,
        column,
        row,
        player: playerNumber as 1 | 2,
        userId: user.id,
        ts: new Date().toISOString()
      }
      const newMoves = [...moves, newMove]

      // Check win/draw
      const isWin = checkWin(newBoard, row, column, playerNumber.toString())
      const isDraw = !isWin && isBoardFull(newBoard)
      const isTerminal = isWin || isDraw

      if (isTerminal) {
        // TERMINAL MOVE: Single atomic update
        if (game.p1RatingBefore === null || game.p2RatingBefore === null) {
          throw new Error('FATAL: Rating snapshots missing')
        }

        const gameResult: GameResult = isDraw ? 'DRAW' : (playerNumber === 1 ? 'P1_WIN' : 'P2_WIN')
        const reason: EndReason = isDraw ? 'BOARD_FULL' : 'CONNECT4'

        let p1Delta: number, p2Delta: number
        let winnerId: string | null = null

        if (isDraw) {
          const deltas = calculateEloDraw(game.p1RatingBefore, game.p2RatingBefore)
          p1Delta = deltas.delta1
          p2Delta = deltas.delta2
        } else if (playerNumber === 1) {
          const deltas = calculateEloChange(game.p1RatingBefore, game.p2RatingBefore)
          p1Delta = deltas.winnerDelta
          p2Delta = deltas.loserDelta
          winnerId = game.player1Id
        } else {
          const deltas = calculateEloChange(game.p2RatingBefore, game.p1RatingBefore)
          p1Delta = deltas.loserDelta
          p2Delta = deltas.winnerDelta
          winnerId = game.player2Id
        }

        // Atomic update
        const updateResult = await tx.game.updateMany({
          where: {
            id: gameId,
            status: 'ACTIVE',
            currentTurn: playerNumber,
            ratingAppliedAt: null
          },
          data: {
            board: newBoard,
            moves: newMoves as unknown as Prisma.InputJsonValue,
            status: 'COMPLETED',
            result: gameResult,
            endedReason: reason,
            winnerId,
            p1RatingDelta: p1Delta,
            p2RatingDelta: p2Delta,
            ratingAppliedAt: new Date(),
            completedAt: new Date()
          }
        })

        if (updateResult.count !== 1) {
          throw new ApiError('MOVE_CONFLICT')
        }

        // Update user ratings
        await tx.user.update({
          where: { id: game.player1Id },
          data: {
            rating: { increment: p1Delta },
            ...(gameResult === 'P1_WIN' ? { wins: { increment: 1 } } : {}),
            ...(gameResult === 'P2_WIN' ? { losses: { increment: 1 } } : {}),
            ...(gameResult === 'DRAW' ? { draws: { increment: 1 } } : {})
          }
        })

        await tx.user.update({
          where: { id: game.player2Id! },
          data: {
            rating: { increment: p2Delta },
            ...(gameResult === 'P2_WIN' ? { wins: { increment: 1 } } : {}),
            ...(gameResult === 'P1_WIN' ? { losses: { increment: 1 } } : {}),
            ...(gameResult === 'DRAW' ? { draws: { increment: 1 } } : {})
          }
        })

        const finalGame = await tx.game.findUnique({
          where: { id: gameId },
          include: {
            player1: { select: { id: true, firebaseUid: true, username: true, rating: true } },
            player2: { select: { id: true, firebaseUid: true, username: true, rating: true } }
          }
        })

        return { status: 'game_ended', reason, game: finalGame!, move: newMove }
      }

      // NON-TERMINAL MOVE
      const nextTurn = playerNumber === 1 ? 2 : 1

      const updateResult = await tx.game.updateMany({
        where: {
          id: gameId,
          status: 'ACTIVE',
          currentTurn: playerNumber,
          ratingAppliedAt: null
        },
        data: {
          board: newBoard,
          moves: newMoves as unknown as Prisma.InputJsonValue,
          currentTurn: nextTurn,
          ...(isPlayer1 ? { player1LastSeen: new Date() } : { player2LastSeen: new Date() })
        }
      })

      if (updateResult.count !== 1) {
        throw new ApiError('MOVE_CONFLICT')
      }

      const updatedGame = await tx.game.findUnique({
        where: { id: gameId },
        include: {
          player1: { select: { id: true, firebaseUid: true, username: true, rating: true } },
          player2: { select: { id: true, firebaseUid: true, username: true, rating: true } }
        }
      })

      return { status: 'move_applied', game: updatedGame!, move: newMove }
    })

    res.json({
      status: result.status,
      reason: 'reason' in result ? result.reason : undefined,
      game: formatGameResponse(result.game),
      move: result.move
    })
  } catch (error) {
    next(error)
  }
})

/**
 * POST /api/games/:id/cancel
 * Cancel a WAITING game (only creator can cancel, only before opponent joins)
 */
router.post('/:id/cancel', authMiddleware, async (req, res: Response, next) => {
  try {
    const { uid } = (req as AuthenticatedRequest).user
    const { id: gameId } = req.params

    const user = await prisma.user.findUnique({ where: { firebaseUid: uid } })
    if (!user) throw new ApiError('USER_NOT_FOUND')

    const game = await prisma.game.findUnique({ where: { id: gameId } })

    if (!game) throw new ApiError('GAME_NOT_FOUND')
    if (game.status !== 'WAITING') throw new ApiError('GAME_ALREADY_STARTED')
    if (game.player1Id !== user.id) throw new ApiError('NOT_GAME_CREATOR')
    if (game.player2Id !== null) throw new ApiError('OPPONENT_ALREADY_JOINED')

    await prisma.game.update({
      where: { id: gameId },
      data: { status: 'ABANDONED' }
    })

    res.json({ success: true })
  } catch (error) {
    next(error)
  }
})

/**
 * POST /api/games/:id/claim-abandoned
 * Claim win when opponent has abandoned
 */
router.post('/:id/claim-abandoned', authMiddleware, async (req, res: Response, next) => {
  try {
    const { uid } = (req as AuthenticatedRequest).user
    const { id: gameId } = req.params

    const user = await prisma.user.findUnique({ where: { firebaseUid: uid } })
    if (!user) throw new ApiError('USER_NOT_FOUND')

    const result = await prisma.$transaction(async (tx) => {
      const game = await tx.game.findUnique({ where: { id: gameId } })

      if (!game) throw new ApiError('GAME_NOT_FOUND')
      if (game.status !== 'ACTIVE') throw new ApiError('GAME_NOT_ACTIVE')
      if (!game.player2Id) throw new ApiError('GAME_NOT_STARTED')

      const isPlayer1 = user.id === game.player1Id
      const isPlayer2 = user.id === game.player2Id
      if (!isPlayer1 && !isPlayer2) throw new ApiError('NOT_IN_GAME')

      // Verify opponent actually abandoned
      if (checkAbandonment(game, user.id) !== 'opponent_abandoned') {
        throw new ApiError('OPPONENT_NOT_ABANDONED')
      }

      // Assert snapshots
      if (game.p1RatingBefore === null || game.p2RatingBefore === null) {
        throw new Error('FATAL: Rating snapshots missing')
      }

      const gameResult: GameResult = isPlayer1 ? 'P1_WIN' : 'P2_WIN'
      const winnerId = isPlayer1 ? game.player1Id : game.player2Id

      let p1Delta: number, p2Delta: number
      if (isPlayer1) {
        const deltas = calculateEloChange(game.p1RatingBefore, game.p2RatingBefore)
        p1Delta = deltas.winnerDelta
        p2Delta = deltas.loserDelta
      } else {
        const deltas = calculateEloChange(game.p2RatingBefore, game.p1RatingBefore)
        p1Delta = deltas.loserDelta
        p2Delta = deltas.winnerDelta
      }

      // Atomic finalize
      const updateResult = await tx.game.updateMany({
        where: {
          id: gameId,
          status: 'ACTIVE',
          ratingAppliedAt: null
        },
        data: {
          status: 'ABANDONED',
          result: gameResult,
          endedReason: 'ABANDONED',
          winnerId,
          p1RatingDelta: p1Delta,
          p2RatingDelta: p2Delta,
          ratingAppliedAt: new Date(),
          completedAt: new Date()
        }
      })

      if (updateResult.count !== 1) {
        // Already finalized - return current state
        const currentGame = await tx.game.findUnique({
          where: { id: gameId },
          include: {
            player1: { select: { id: true, firebaseUid: true, username: true, rating: true } },
            player2: { select: { id: true, firebaseUid: true, username: true, rating: true } }
          }
        })
        return currentGame!
      }

      // Update user ratings
      await tx.user.update({
        where: { id: game.player1Id },
        data: {
          rating: { increment: p1Delta },
          ...(gameResult === 'P1_WIN' ? { wins: { increment: 1 } } : { losses: { increment: 1 } })
        }
      })

      await tx.user.update({
        where: { id: game.player2Id! },
        data: {
          rating: { increment: p2Delta },
          ...(gameResult === 'P2_WIN' ? { wins: { increment: 1 } } : { losses: { increment: 1 } })
        }
      })

      const finalGame = await tx.game.findUnique({
        where: { id: gameId },
        include: {
          player1: { select: { id: true, firebaseUid: true, username: true, rating: true } },
          player2: { select: { id: true, firebaseUid: true, username: true, rating: true } }
        }
      })

      return finalGame!
    })

    res.json({ game: formatGameResponse(result) })
  } catch (error) {
    next(error)
  }
})

/**
 * POST /api/games/:id/rematch
 * Request or accept a rematch
 */
router.post('/:id/rematch', authMiddleware, async (req, res: Response, next) => {
  try {
    const { uid } = (req as AuthenticatedRequest).user
    const { id: gameId } = req.params

    const user = await prisma.user.findUnique({ where: { firebaseUid: uid } })
    if (!user) throw new ApiError('USER_NOT_FOUND')

    const result = await prisma.$transaction(async (tx) => {
      const game = await tx.game.findUnique({ where: { id: gameId } })

      if (!game) throw new ApiError('GAME_NOT_FOUND')
      if (!['COMPLETED', 'ABANDONED'].includes(game.status)) throw new ApiError('GAME_NOT_FINISHED')
      if (!game.player2Id) throw new ApiError('NOT_IN_GAME')

      const isPlayer1 = user.id === game.player1Id
      const isPlayer2 = user.id === game.player2Id
      if (!isPlayer1 && !isPlayer2) throw new ApiError('NOT_IN_GAME')

      const playerNumber = isPlayer1 ? 1 : 2

      // If already has rematch game, return it
      if (game.rematchGameId) {
        const rematchGame = await tx.game.findUnique({
          where: { id: game.rematchGameId },
          include: {
            player1: { select: { id: true, firebaseUid: true, username: true, rating: true } },
            player2: { select: { id: true, firebaseUid: true, username: true, rating: true } }
          }
        })
        return { status: 'accepted', newGame: rematchGame! }
      }

      // If no request yet, create request
      if (!game.rematchRequestedBy) {
        await tx.game.update({
          where: { id: gameId },
          data: { rematchRequestedBy: playerNumber }
        })
        return { status: 'requested' }
      }

      // If same player requested again, still pending
      if (game.rematchRequestedBy === playerNumber) {
        return { status: 'requested' }
      }

      // ACCEPT REMATCH - other player requested, this is acceptance

      // Check neither player has another active game (besides this completed one)
      const [p1ActiveGame, p2ActiveGame] = await Promise.all([
        getActiveGameForUser(tx, game.player1Id),
        getActiveGameForUser(tx, game.player2Id!)
      ])

      if (p1ActiveGame || p2ActiveGame) {
        throw new ApiError('HAS_ACTIVE_GAME')
      }

      const [player1Data, player2Data] = await Promise.all([
        tx.user.findUnique({ where: { id: game.player1Id } }),
        tx.user.findUnique({ where: { id: game.player2Id! } })
      ])

      // Create new game with swapped colors
      const newGame = await createGameWithPublicId(tx, {
        player1: { connect: { id: game.player2Id! } }, // swap
        player2: { connect: { id: game.player1Id } }, // swap
        status: 'ACTIVE',
        currentTurn: 1,
        p1RatingBefore: player2Data!.rating,
        p2RatingBefore: player1Data!.rating,
        player1LastSeen: new Date(),
        player2LastSeen: new Date()
      })

      // Link rematch game atomically without race conditions
      await tx.game.update({
        where: { id: gameId },
        data: { rematchGameId: newGame.id }
      })

      const fullNewGame = await tx.game.findUnique({
        where: { id: newGame.id },
        include: {
          player1: { select: { id: true, firebaseUid: true, username: true, rating: true } },
          player2: { select: { id: true, firebaseUid: true, username: true, rating: true } }
        }
      })

      return { status: 'accepted', newGame: fullNewGame! }
    })

    if (result.status === 'requested') {
      res.json({ status: 'requested' })
    } else {
      const newGame = result.newGame!
      res.json({
        status: 'accepted',
        newGameId: newGame.id,
        newPublicId: newGame.publicId,
        game: formatGameResponse(newGame)
      })
    }
  } catch (error) {
    next(error)
  }
})

/**
 * POST /api/games/:id/resign
 * Resign from a game (forfeit)
 */
router.post('/:id/resign', authMiddleware, async (req, res: Response, next) => {
  try {
    const { uid } = (req as AuthenticatedRequest).user
    const { id: gameId } = req.params

    const user = await prisma.user.findUnique({ where: { firebaseUid: uid } })
    if (!user) throw new ApiError('USER_NOT_FOUND')

    const result = await prisma.$transaction(async (tx) => {
      const game = await tx.game.findUnique({ where: { id: gameId } })

      if (!game) throw new ApiError('GAME_NOT_FOUND')
      if (game.status !== 'ACTIVE') throw new ApiError('GAME_NOT_ACTIVE')
      if (!game.player2Id) throw new ApiError('GAME_NOT_STARTED')

      const isPlayer1 = user.id === game.player1Id
      const isPlayer2 = user.id === game.player2Id
      if (!isPlayer1 && !isPlayer2) throw new ApiError('NOT_IN_GAME')

      // Assert snapshots
      if (game.p1RatingBefore === null || game.p2RatingBefore === null) {
        throw new Error('FATAL: Rating snapshots missing')
      }

      // Resigning player loses, opponent wins
      const gameResult: GameResult = isPlayer1 ? 'P2_WIN' : 'P1_WIN'
      const winnerId = isPlayer1 ? game.player2Id : game.player1Id

      // Calculate ELO changes
      let p1Delta: number, p2Delta: number
      if (isPlayer1) {
        // Player 1 resigned, Player 2 wins
        const deltas = calculateEloChange(game.p2RatingBefore, game.p1RatingBefore)
        p1Delta = deltas.loserDelta
        p2Delta = deltas.winnerDelta
      } else {
        // Player 2 resigned, Player 1 wins
        const deltas = calculateEloChange(game.p1RatingBefore, game.p2RatingBefore)
        p1Delta = deltas.winnerDelta
        p2Delta = deltas.loserDelta
      }

      // Atomic finalize
      const updateResult = await tx.game.updateMany({
        where: {
          id: gameId,
          status: 'ACTIVE',
          ratingAppliedAt: null
        },
        data: {
          status: 'COMPLETED',
          result: gameResult,
          endedReason: 'RESIGNED',
          winnerId,
          p1RatingDelta: p1Delta,
          p2RatingDelta: p2Delta,
          ratingAppliedAt: new Date(),
          completedAt: new Date()
        }
      })

      if (updateResult.count !== 1) {
        // Already finalized - return current state
        const currentGame = await tx.game.findUnique({
          where: { id: gameId },
          include: {
            player1: { select: { id: true, firebaseUid: true, username: true, rating: true } },
            player2: { select: { id: true, firebaseUid: true, username: true, rating: true } }
          }
        })
        return currentGame!
      }

      // Update user ratings
      await tx.user.update({
        where: { id: game.player1Id },
        data: {
          rating: { increment: p1Delta },
          ...(gameResult === 'P1_WIN' ? { wins: { increment: 1 } } : { losses: { increment: 1 } })
        }
      })

      await tx.user.update({
        where: { id: game.player2Id! },
        data: {
          rating: { increment: p2Delta },
          ...(gameResult === 'P2_WIN' ? { wins: { increment: 1 } } : { losses: { increment: 1 } })
        }
      })

      const finalGame = await tx.game.findUnique({
        where: { id: gameId },
        include: {
          player1: { select: { id: true, firebaseUid: true, username: true, rating: true } },
          player2: { select: { id: true, firebaseUid: true, username: true, rating: true } }
        }
      })

      return finalGame!
    })

    res.json({ game: formatGameResponse(result) })
  } catch (error) {
    next(error)
  }
})

export default router
