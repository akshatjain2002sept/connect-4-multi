# Connect 4 - Technical Specification v7 (Final)

## Overview

A web-based Connect 4 game with user authentication, real-time multiplayer, and an Elo rating system. Players can queue for random matchmaking or create private games with friends.

### Goals

1. Learn AI tooling workflows (CLI agents, agentic coding)
2. Build a complete full-stack application with persistent database and user session management
3. Create an intuitive, polished UI with a nostalgic "Digital Plastic" aesthetic

### Tech Stack

| Layer | Technology |
|-------|------------|
| Frontend | React + Tailwind CSS + shadcn/ui |
| Backend | Express.js (Node.js) on Railway |
| Database | PostgreSQL + Prisma ORM on Railway |
| Authentication | Firebase Auth (Google OAuth + Guest) |
| Real-time | Polling (v1), WebSockets (future) |

### Deployment Constraints

- **Single Railway instance required for v1** - matchmaking queue is in-memory and does not persist across instances or restarts
- **Explicitly disable Railway autoscaling** - ensure instance count is locked to 1
- Users in queue during a deploy/restart will need to re-queue (acceptable UX tradeoff for v1 simplicity)

---

## Key Changes Summary

### v5 Fixes (from v4)
1. Prisma optimistic lock → `updateMany` + count check
2. Race-proof `finalizeGame` → conditional `updateMany`
3. Use rating snapshots for Elo
4. Transaction-aware `createGameWithPublicId`
5. Prisma JSON default → `dbgenerated`
6. WAITING expiry → use `player1LastSeen`
7. Queue stale threshold → 30 seconds
8. Elo zero-sum enforcement
9. Move-triggered abandonment
10. Abandonment claim UX (check before turn validation)

### v6 Fixes (from v5)
11. **Terminal move atomic transaction** - Move + finalize + rating updates in single transaction
12. **Rematch optimistic locking** - Prevent duplicate rematch games with `updateMany` on `rematchGameId: null`
13. **Safe moves JSON parsing** - Runtime validation of `game.moves`
14. **Dedicated claim-abandoned endpoint** - Cleaner than overloading move endpoint

---

## Database Schema

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

model User {
  id          String   @id @default(uuid())
  firebaseUid String   @unique
  email       String?  // null for guests
  username    String   @unique
  isGuest     Boolean  @default(false)
  rating      Int      @default(1000)
  wins        Int      @default(0)
  losses      Int      @default(0)
  draws       Int      @default(0)
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  gamesAsPlayer1 Game[] @relation("Player1")
  gamesAsPlayer2 Game[] @relation("Player2")
  gamesWon       Game[] @relation("Winner")

  @@index([rating])
  @@index([createdAt])
}

model Game {
  id              String      @id @default(uuid())
  publicId        String      @unique // 8-char base32 for URLs/display
  code            String?     @unique // for private games, null for matchmaking

  // Players
  player1         User        @relation("Player1", fields: [player1Id], references: [id])
  player1Id       String
  player2         User?       @relation("Player2", fields: [player2Id], references: [id])
  player2Id       String?
  
  // Game state
  board           String      @default("000000000000000000000000000000000000000000") // 42 chars
  currentTurn     Int         @default(1) // 1 or 2
  status          GameStatus  @default(WAITING)
  moves           Json        @default(dbgenerated("'[]'::jsonb"))
  
  // Result tracking
  result          GameResult?
  endedReason     EndReason?
  winner          User?       @relation("Winner", fields: [winnerId], references: [id])
  winnerId        String?
  
  // Rating snapshots - REQUIRED when status becomes ACTIVE
  p1RatingBefore  Int?
  p2RatingBefore  Int?
  p1RatingDelta   Int?
  p2RatingDelta   Int?
  ratingAppliedAt DateTime?
  
  // Rematch
  rematchRequestedBy Int?
  rematchGameId      String?
  
  // Heartbeat / abandonment
  player1LastSeen DateTime?
  player2LastSeen DateTime?
  
  // Timestamps
  createdAt       DateTime    @default(now())
  updatedAt       DateTime    @updatedAt
  completedAt     DateTime?

  @@index([player1Id, createdAt])
  @@index([player2Id, createdAt])
  @@index([code])
  @@index([status])
  @@index([updatedAt])
  @@index([publicId])
}

enum GameStatus {
  WAITING
  ACTIVE
  COMPLETED
  ABANDONED
}

enum GameResult {
  P1_WIN
  P2_WIN
  DRAW
}

enum EndReason {
  CONNECT4
  BOARD_FULL
  ABANDONED
}
```

### Rating Snapshot Invariants

**On WAITING → ACTIVE:**
- `p1RatingBefore` and `p2RatingBefore` MUST be set
- Hard assert in code

**On finalization:**
- `p1RatingDelta`, `p2RatingDelta`, `ratingAppliedAt` MUST be set

---

## Helper Functions

### Board Validation

```typescript
function assertValidBoard(board: string): void {
  if (board.length !== 42) {
    throw new Error(`Invalid board length: ${board.length}, expected 42`)
  }
  if (!/^[012]{42}$/.test(board)) {
    throw new Error('Invalid board characters')
  }
}
```

### Moves JSON Parsing (Safe)

```typescript
interface Move {
  moveNumber: number
  column: number
  row: number
  player: 1 | 2
  userId: string
  ts: string
}

function parseMoves(moves: unknown): Move[] {
  if (!Array.isArray(moves)) {
    console.warn('Invalid moves format, defaulting to empty array')
    return []
  }
  return moves as Move[]
}
```

### Public ID Generation

```typescript
const BASE32_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'

function generatePublicId(): string {
  let id = ''
  for (let i = 0; i < 8; i++) {
    id += BASE32_CHARS[Math.floor(Math.random() * BASE32_CHARS.length)]
  }
  return id
}

// Transaction-aware
async function createGameWithPublicId(
  db: PrismaClient | Prisma.TransactionClient,
  data: Omit<Prisma.GameCreateInput, 'publicId'>
): Promise<Game> {
  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      return await db.game.create({
        data: { ...data, publicId: generatePublicId() }
      })
    } catch (e: any) {
      if (e.code === 'P2002' && e.meta?.target?.includes('publicId')) continue
      throw e
    }
  }
  throw new Error('Failed to generate unique publicId')
}
```

### Game Logic

```typescript
function findDropRow(board: string, column: number): number | null {
  if (column < 0 || column > 6) return null
  for (let row = 5; row >= 0; row--) {
    if (board[row * 7 + column] === '0') return row
  }
  return null
}

function applyMove(board: string, column: number, player: 1 | 2): { newBoard: string; row: number } | null {
  assertValidBoard(board)
  const row = findDropRow(board, column)
  if (row === null) return null
  const index = row * 7 + column
  const newBoard = board.substring(0, index) + player.toString() + board.substring(index + 1)
  assertValidBoard(newBoard)
  return { newBoard, row }
}

const DIRECTIONS = [
  { dr: 0, dc: 1 },
  { dr: 1, dc: 0 },
  { dr: 1, dc: 1 },
  { dr: 1, dc: -1 },
]

function checkWin(board: string, row: number, col: number, player: string): boolean {
  for (const { dr, dc } of DIRECTIONS) {
    let count = 1
    for (let i = 1; i < 4; i++) {
      const r = row + dr * i, c = col + dc * i
      if (r < 0 || r > 5 || c < 0 || c > 6 || board[r * 7 + c] !== player) break
      count++
    }
    for (let i = 1; i < 4; i++) {
      const r = row - dr * i, c = col - dc * i
      if (r < 0 || r > 5 || c < 0 || c > 6 || board[r * 7 + c] !== player) break
      count++
    }
    if (count >= 4) return true
  }
  return false
}

function isBoardFull(board: string): boolean {
  return !board.includes('0')
}
```

### Elo Calculation (Zero-Sum)

```typescript
function calculateEloChange(winnerRating: number, loserRating: number): { winnerDelta: number; loserDelta: number } {
  const expected = 1 / (1 + Math.pow(10, (loserRating - winnerRating) / 400))
  const winnerDelta = Math.round(32 * (1 - expected))
  return { winnerDelta, loserDelta: -winnerDelta }
}

function calculateEloDraw(rating1: number, rating2: number): { delta1: number; delta2: number } {
  const expected1 = 1 / (1 + Math.pow(10, (rating2 - rating1) / 400))
  const delta1 = Math.round(32 * (0.5 - expected1))
  return { delta1, delta2: -delta1 }
}
```

### Abandonment Check

```typescript
const ABANDON_THRESHOLD_MS = 30 * 1000

function checkAbandonment(game: Game, requestingUserId: string): 'none' | 'opponent_abandoned' {
  if (game.status !== 'ACTIVE' || !game.player2Id) return 'none'
  
  const isPlayer1 = requestingUserId === game.player1Id
  const opponentLastSeen = isPlayer1 ? game.player2LastSeen : game.player1LastSeen
  
  if (!opponentLastSeen) return 'none'
  if (Date.now() - opponentLastSeen.getTime() > ABANDON_THRESHOLD_MS) {
    return 'opponent_abandoned'
  }
  return 'none'
}
```

---

## Move Endpoint (Atomic Terminal Handling)

Terminal moves (win/draw) apply move + finalize + rating updates in a **single transaction**.

### Request Schema

```typescript
interface MoveRequest {
  column: number              // 0-6
}
```

### Implementation

```typescript
type MoveResult =
  | { status: 'move_applied'; game: Game; move: Move }
  | { status: 'game_ended'; reason: EndReason; game: Game; move: Move }
  | { status: 'abandoned_win'; game: Game }

async function handleMove(
  gameId: string,
  requestingUserId: string,
  column: number
): Promise<MoveResult> {
  return prisma.$transaction(async (tx) => {
    // 1. Read game
    const game = await tx.game.findUnique({ where: { id: gameId } })
    
    if (!game) throw new ApiError('GAME_NOT_FOUND', 404)
    if (game.status !== 'ACTIVE') throw new ApiError('GAME_NOT_ACTIVE', 409)
    if (!game.player2Id) throw new ApiError('GAME_NOT_STARTED', 409)
    
    // 2. Determine player
    const isPlayer1 = requestingUserId === game.player1Id
    const isPlayer2 = requestingUserId === game.player2Id
    if (!isPlayer1 && !isPlayer2) throw new ApiError('NOT_IN_GAME', 403)
    const playerNumber = isPlayer1 ? 1 : 2
    
    // 3. Check abandonment BEFORE turn validation
    if (checkAbandonment(game, requestingUserId) === 'opponent_abandoned') {
      // Handle via dedicated endpoint - reject here
      throw new ApiError('USE_CLAIM_ABANDONED_ENDPOINT', 400)
    }
    
    // 4. Validate turn
    if (game.currentTurn !== playerNumber) {
      throw new ApiError('NOT_YOUR_TURN', 403)
    }
    
    // 5. Validate and apply move
    if (column < 0 || column > 6) throw new ApiError('INVALID_COLUMN', 400)
    
    const moveResult = applyMove(game.board, column, playerNumber as 1 | 2)
    if (!moveResult) throw new ApiError('COLUMN_FULL', 400)
    
    const { newBoard, row } = moveResult
    const moves = parseMoves(game.moves)
    const newMove: Move = {
      moveNumber: moves.length + 1,
      column,
      row,
      player: playerNumber as 1 | 2,
      userId: requestingUserId,
      ts: new Date().toISOString(),
    }
    const newMoves = [...moves, newMove]
    
    // 6. Check win/draw
    const isWin = checkWin(newBoard, row, column, playerNumber.toString())
    const isDraw = !isWin && isBoardFull(newBoard)
    const isTerminal = isWin || isDraw
    
    if (isTerminal) {
      // === TERMINAL MOVE: Single atomic update ===
      
      // Assert snapshots exist
      if (game.p1RatingBefore === null || game.p2RatingBefore === null) {
        throw new Error('FATAL: Rating snapshots missing')
      }
      
      // Calculate result and deltas
      const result: GameResult = isDraw ? 'DRAW' : (playerNumber === 1 ? 'P1_WIN' : 'P2_WIN')
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
      
      // Atomic update: move + finalize in one updateMany
      const updateResult = await tx.game.updateMany({
        where: {
          id: gameId,
          status: 'ACTIVE',
          currentTurn: playerNumber,
          ratingAppliedAt: null,
        },
        data: {
          board: newBoard,
          moves: newMoves,
          status: 'COMPLETED',
          result,
          endedReason: reason,
          winnerId,
          p1RatingDelta: p1Delta,
          p2RatingDelta: p2Delta,
          ratingAppliedAt: new Date(),
          completedAt: new Date(),
        },
      })
      
      if (updateResult.count !== 1) {
        throw new ApiError('MOVE_CONFLICT', 409)
      }
      
      // Update user ratings in same transaction
      await tx.user.update({
        where: { id: game.player1Id },
        data: {
          rating: { increment: p1Delta },
          ...(result === 'P1_WIN' ? { wins: { increment: 1 } } : {}),
          ...(result === 'P2_WIN' ? { losses: { increment: 1 } } : {}),
          ...(result === 'DRAW' ? { draws: { increment: 1 } } : {}),
        },
      })
      
      await tx.user.update({
        where: { id: game.player2Id },
        data: {
          rating: { increment: p2Delta },
          ...(result === 'P2_WIN' ? { wins: { increment: 1 } } : {}),
          ...(result === 'P1_WIN' ? { losses: { increment: 1 } } : {}),
          ...(result === 'DRAW' ? { draws: { increment: 1 } } : {}),
        },
      })
      
      const finalGame = await tx.game.findUnique({ where: { id: gameId } })
      return { status: 'game_ended', reason, game: finalGame!, move: newMove }
    }
    
    // === NON-TERMINAL MOVE ===
    const nextTurn = playerNumber === 1 ? 2 : 1

    // Build update data without computed keys
    const updateData: Prisma.GameUpdateManyMutationInput = {
      board: newBoard,
      moves: newMoves,
      currentTurn: nextTurn,
    }
    if (isPlayer1) {
      updateData.player1LastSeen = new Date()
    } else {
      updateData.player2LastSeen = new Date()
    }

    const updateResult = await tx.game.updateMany({
      where: {
        id: gameId,
        status: 'ACTIVE',
        currentTurn: playerNumber,
        ratingAppliedAt: null,
      },
      data: updateData,
    })
    
    if (updateResult.count !== 1) {
      throw new ApiError('MOVE_CONFLICT', 409)
    }
    
    const updatedGame = await tx.game.findUnique({ where: { id: gameId } })
    return { status: 'move_applied', game: updatedGame!, move: newMove }
  })
}
```

---

## Claim Abandoned Endpoint

Dedicated endpoint for claiming abandonment win. Cleaner than overloading the move endpoint.

```typescript
// POST /api/games/:id/claim-abandoned

async function handleClaimAbandoned(
  gameId: string,
  requestingUserId: string
): Promise<{ game: Game }> {
  return prisma.$transaction(async (tx) => {
    const game = await tx.game.findUnique({ where: { id: gameId } })
    
    if (!game) throw new ApiError('GAME_NOT_FOUND', 404)
    if (game.status !== 'ACTIVE') throw new ApiError('GAME_NOT_ACTIVE', 409)
    if (!game.player2Id) throw new ApiError('GAME_NOT_STARTED', 409)
    
    const isPlayer1 = requestingUserId === game.player1Id
    const isPlayer2 = requestingUserId === game.player2Id
    if (!isPlayer1 && !isPlayer2) throw new ApiError('NOT_IN_GAME', 403)
    
    // Verify opponent actually abandoned
    if (checkAbandonment(game, requestingUserId) !== 'opponent_abandoned') {
      throw new ApiError('OPPONENT_NOT_ABANDONED', 400)
    }
    
    // Assert snapshots
    if (game.p1RatingBefore === null || game.p2RatingBefore === null) {
      throw new Error('FATAL: Rating snapshots missing')
    }
    
    // Calculate result
    const result: GameResult = isPlayer1 ? 'P1_WIN' : 'P2_WIN'
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
        ratingAppliedAt: null,
      },
      data: {
        status: 'ABANDONED',
        result,
        endedReason: 'ABANDONED',
        winnerId,
        p1RatingDelta: p1Delta,
        p2RatingDelta: p2Delta,
        ratingAppliedAt: new Date(),
        completedAt: new Date(),
      },
    })
    
    if (updateResult.count !== 1) {
      // Already finalized - return current state
      const currentGame = await tx.game.findUnique({ where: { id: gameId } })
      return { game: currentGame! }
    }
    
    // Update user ratings
    await tx.user.update({
      where: { id: game.player1Id },
      data: {
        rating: { increment: p1Delta },
        ...(result === 'P1_WIN' ? { wins: { increment: 1 } } : { losses: { increment: 1 } }),
      },
    })
    
    await tx.user.update({
      where: { id: game.player2Id },
      data: {
        rating: { increment: p2Delta },
        ...(result === 'P2_WIN' ? { wins: { increment: 1 } } : { losses: { increment: 1 } }),
      },
    })
    
    const finalGame = await tx.game.findUnique({ where: { id: gameId } })
    return { game: finalGame! }
  })
}
```

---

## Rematch System (Race-Protected)

**Critical v7 fix:** Prevent duplicate rematch games with optimistic locking on `rematchGameId`.

```typescript
type RematchResult =
  | { status: 'requested' }
  | { status: 'accepted'; newGameId: string; newPublicId: string }

async function handleRematch(gameId: string, requestingUserId: string): Promise<RematchResult> {
  return prisma.$transaction(async (tx) => {
    const game = await tx.game.findUnique({ where: { id: gameId } })
    
    if (!game) throw new ApiError('GAME_NOT_FOUND', 404)
    if (!['COMPLETED', 'ABANDONED'].includes(game.status)) throw new ApiError('GAME_NOT_FINISHED', 409)
    if (!game.player2Id) throw new ApiError('NO_OPPONENT', 400)
    
    const isPlayer1 = requestingUserId === game.player1Id
    const isPlayer2 = requestingUserId === game.player2Id
    if (!isPlayer1 && !isPlayer2) throw new ApiError('NOT_IN_GAME', 403)
    
    const playerNumber = isPlayer1 ? 1 : 2
    
    // If already has rematch game, return it
    if (game.rematchGameId) {
      const rematchGame = await tx.game.findUnique({ where: { id: game.rematchGameId } })
      return { status: 'accepted', newGameId: game.rematchGameId, newPublicId: rematchGame!.publicId }
    }
    
    // If no request yet, create request
    if (!game.rematchRequestedBy) {
      await tx.game.update({
        where: { id: gameId },
        data: { rematchRequestedBy: playerNumber },
      })
      return { status: 'requested' }
    }
    
    // If same player requested again, still pending
    if (game.rematchRequestedBy === playerNumber) {
      return { status: 'requested' }
    }
    
    // === ACCEPT REMATCH ===
    // Other player requested, this is acceptance
    
    const [player1Data, player2Data] = await Promise.all([
      tx.user.findUnique({ where: { id: game.player1Id } }),
      tx.user.findUnique({ where: { id: game.player2Id } }),
    ])
    
    // Create new game with swapped colors
    const newGame = await createGameWithPublicId(tx, {
      player1Id: game.player2Id,  // swap
      player2Id: game.player1Id,  // swap
      status: 'ACTIVE',
      currentTurn: 1,
      p1RatingBefore: player2Data!.rating,
      p2RatingBefore: player1Data!.rating,
      player1LastSeen: new Date(),
      player2LastSeen: new Date(),
    })
    
    // CRITICAL: Optimistic lock on rematchGameId to prevent duplicates
    const linkResult = await tx.game.updateMany({
      where: {
        id: gameId,
        rematchGameId: null,  // Only if not already linked
      },
      data: {
        rematchGameId: newGame.id,
      },
    })
    
    if (linkResult.count !== 1) {
      // Another transaction won - delete orphan and return existing rematch
      await tx.game.delete({ where: { id: newGame.id } })
      
      const updatedOriginal = await tx.game.findUnique({ where: { id: gameId } })
      const existingRematch = await tx.game.findUnique({ where: { id: updatedOriginal!.rematchGameId! } })
      return { status: 'accepted', newGameId: existingRematch!.id, newPublicId: existingRematch!.publicId }
    }
    
    return { status: 'accepted', newGameId: newGame.id, newPublicId: newGame.publicId }
  })
}
```

---

## Join Private Game

```typescript
async function joinGameByCode(code: string, joiningUserId: string): Promise<JoinResult> {
  if (!/^[A-HJ-NP-Z2-9]{6}$/i.test(code)) {
    return { error: 'INVALID_CODE_FORMAT' }
  }
  
  const activeGame = await getActiveGameForUser(joiningUserId)
  if (activeGame) return { error: 'HAS_ACTIVE_GAME' }
  
  try {
    const result = await prisma.$transaction(async (tx) => {
      const game = await tx.game.findUnique({
        where: { code: code.toUpperCase() },
        include: { player1: true },
      })
      
      if (!game) throw new ApiError('GAME_NOT_FOUND', 404)
      if (game.status !== 'WAITING') throw new ApiError('GAME_ALREADY_STARTED', 409)
      if (game.player2Id !== null) throw new ApiError('GAME_ALREADY_STARTED', 409)
      if (game.player1Id === joiningUserId) throw new ApiError('CANNOT_JOIN_OWN_GAME', 400)
      
      const joiningPlayer = await tx.user.findUnique({ where: { id: joiningUserId } })
      if (!joiningPlayer) throw new ApiError('USER_NOT_FOUND', 404)
      
      const player1GoesFirst = Math.random() < 0.5
      
      const updateResult = await tx.game.updateMany({
        where: {
          id: game.id,
          status: 'WAITING',
          player2Id: null,
        },
        data: {
          player2Id: joiningUserId,
          status: 'ACTIVE',
          currentTurn: player1GoesFirst ? 1 : 2,
          p1RatingBefore: game.player1.rating,
          p2RatingBefore: joiningPlayer.rating,
          player1LastSeen: new Date(),
          player2LastSeen: new Date(),
        },
      })
      
      if (updateResult.count !== 1) {
        throw new ApiError('GAME_ALREADY_STARTED', 409)
      }
      
      const updatedGame = await tx.game.findUnique({ where: { id: game.id } })
      
      if (updatedGame!.p1RatingBefore === null || updatedGame!.p2RatingBefore === null) {
        throw new Error('FATAL: Rating snapshots not set')
      }
      
      return updatedGame!
    })
    
    return { success: true, gameId: result.id, publicId: result.publicId }
  } catch (e) {
    if (e instanceof ApiError) return { error: e.code }
    throw e
  }
}
```

---

## Create Private Game

```typescript
async function createPrivateGame(hostUserId: string): Promise<CreateGameResult> {
  const activeGame = await getActiveGameForUser(hostUserId)
  if (activeGame) return { error: 'HAS_ACTIVE_GAME' }
  
  const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  
  for (let attempt = 0; attempt < 5; attempt++) {
    let code = ''
    for (let i = 0; i < 6; i++) {
      code += CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)]
    }
    
    try {
      const game = await createGameWithPublicId(prisma, {
        player1Id: hostUserId,
        code,
        status: 'WAITING',
        player1LastSeen: new Date(),  // Always set on create
      })
      return { success: true, game }
    } catch (e: any) {
      if (e.code === 'P2002' && e.meta?.target?.includes('code')) continue
      throw e
    }
  }
  throw new Error('Failed to generate unique game code')
}
```

---

## Matchmaking

### Queue Structure

```typescript
import { Mutex } from 'async-mutex'

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
```

### Join Queue

```typescript
async function joinQueue(userId: string, username: string, rating: number): Promise<JoinQueueResult> {
  return matchmakingMutex.runExclusive(async () => {
    if (matchmakingQueue.has(userId)) return { status: 'already_queued' }
    
    const activeGame = await getActiveGameForUser(userId)
    if (activeGame) return { status: 'has_active_game', gameId: activeGame.id }
    
    cleanupStaleQueueEntries()
    
    // Find match (FIFO)
    let matchedUserId: string | null = null
    let matchedEntry: QueueEntry | null = null
    
    for (const [id, entry] of matchmakingQueue) {
      if (id !== userId) {
        matchedUserId = id
        matchedEntry = entry
        break
      }
    }
    
    if (matchedUserId && matchedEntry) {
      matchmakingQueue.delete(matchedUserId)
      
      const matchedActiveGame = await getActiveGameForUser(matchedUserId)
      if (matchedActiveGame) {
        matchmakingQueue.set(userId, {
          userId, username, rating,
          joinedAt: new Date(), lastHeartbeat: new Date(),
        })
        return { status: 'queued' }
      }
      
      const player1GoesFirst = Math.random() < 0.5
      const [p1Data, p2Data] = await Promise.all([
        prisma.user.findUnique({ where: { id: matchedUserId } }),
        prisma.user.findUnique({ where: { id: userId } }),
      ])
      
      const game = await createGameWithPublicId(prisma, {
        player1Id: matchedUserId,
        player2Id: userId,
        status: 'ACTIVE',
        currentTurn: player1GoesFirst ? 1 : 2,
        p1RatingBefore: p1Data!.rating,
        p2RatingBefore: p2Data!.rating,
        player1LastSeen: new Date(),
        player2LastSeen: new Date(),
      })
      
      return { status: 'matched', gameId: game.id, publicId: game.publicId }
    }
    
    matchmakingQueue.set(userId, {
      userId, username, rating,
      joinedAt: new Date(), lastHeartbeat: new Date(),
    })
    return { status: 'queued' }
  })
}
```

### Check Queue Status

```typescript
async function checkQueueStatus(userId: string): Promise<QueueStatusResult> {
  return matchmakingMutex.runExclusive(async () => {
    const entry = matchmakingQueue.get(userId)
    
    if (!entry) {
      const activeGame = await getActiveGameForUser(userId)
      if (activeGame?.status === 'ACTIVE') {
        return { status: 'matched', gameId: activeGame.id, publicId: activeGame.publicId }
      }
      return { status: 'not_queued' }
    }
    
    entry.lastHeartbeat = new Date()
    cleanupStaleQueueEntries()
    
    // Try to match
    let matchedUserId: string | null = null
    let matchedEntry: QueueEntry | null = null
    
    for (const [id, other] of matchmakingQueue) {
      if (id !== userId) {
        matchedUserId = id
        matchedEntry = other
        break
      }
    }
    
    if (matchedUserId && matchedEntry) {
      matchmakingQueue.delete(userId)
      matchmakingQueue.delete(matchedUserId)
      
      const [myActive, theirActive] = await Promise.all([
        getActiveGameForUser(userId),
        getActiveGameForUser(matchedUserId),
      ])
      
      if (myActive || theirActive) {
        if (!myActive) matchmakingQueue.set(userId, entry)
        if (!theirActive) matchmakingQueue.set(matchedUserId, matchedEntry)
        return { status: 'queued', queuedAt: entry.joinedAt.toISOString() }
      }
      
      const player1GoesFirst = Math.random() < 0.5
      const [p1Data, p2Data] = await Promise.all([
        prisma.user.findUnique({ where: { id: matchedUserId } }),
        prisma.user.findUnique({ where: { id: userId } }),
      ])
      
      const game = await createGameWithPublicId(prisma, {
        player1Id: matchedUserId,
        player2Id: userId,
        status: 'ACTIVE',
        currentTurn: player1GoesFirst ? 1 : 2,
        p1RatingBefore: p1Data!.rating,
        p2RatingBefore: p2Data!.rating,
        player1LastSeen: new Date(),
        player2LastSeen: new Date(),
      })
      
      return { status: 'matched', gameId: game.id, publicId: game.publicId }
    }
    
    return { status: 'queued', queuedAt: entry.joinedAt.toISOString() }
  })
}
```

### Leave Queue

```typescript
async function leaveQueue(userId: string): Promise<{ status: 'left' | 'not_queued' }> {
  return matchmakingMutex.runExclusive(async () => {
    if (matchmakingQueue.delete(userId)) return { status: 'left' }
    return { status: 'not_queued' }
  })
}
```

### Stale Cleanup

```typescript
function cleanupStaleQueueEntries(): void {
  const now = Date.now()
  for (const [userId, entry] of matchmakingQueue) {
    if (now - entry.lastHeartbeat.getTime() > QUEUE_STALE_THRESHOLD_MS) {
      matchmakingQueue.delete(userId)
    }
  }
}

setInterval(() => {
  matchmakingMutex.runExclusive(() => cleanupStaleQueueEntries())
}, 10000)
```

### Helper

```typescript
async function getActiveGameForUser(userId: string): Promise<Game | null> {
  return prisma.game.findFirst({
    where: {
      OR: [{ player1Id: userId }, { player2Id: userId }],
      status: { in: ['WAITING', 'ACTIVE'] },
    },
  })
}
```

---

## API Endpoints

### Authentication

All endpoints except `/api/health` require:
```
Authorization: Bearer <firebase-id-token>
```

### Error Codes

| Code | HTTP | Description |
|------|------|-------------|
| `UNAUTHORIZED` | 401 | Missing/invalid token |
| `USER_NOT_FOUND` | 404 | User doesn't exist |
| `GAME_NOT_FOUND` | 404 | Game doesn't exist |
| `GAME_NOT_ACTIVE` | 409 | Game not ACTIVE |
| `GAME_NOT_FINISHED` | 409 | Game not COMPLETED/ABANDONED |
| `GAME_NOT_STARTED` | 409 | Game still WAITING |
| `GAME_ALREADY_STARTED` | 409 | Game has two players |
| `NOT_YOUR_TURN` | 403 | Not your turn |
| `NOT_IN_GAME` | 403 | Not a player |
| `CANNOT_JOIN_OWN_GAME` | 400 | Can't join own game |
| `HAS_ACTIVE_GAME` | 409 | Already in a game |
| `INVALID_COLUMN` | 400 | Column not 0-6 |
| `COLUMN_FULL` | 400 | Column full |
| `INVALID_CODE_FORMAT` | 400 | Bad game code |
| `ALREADY_QUEUED` | 409 | Already in queue |
| `NOT_QUEUED` | 400 | Not in queue |
| `OPPONENT_NOT_ABANDONED` | 400 | Can't claim - opponent still active |
| `USE_CLAIM_ABANDONED_ENDPOINT` | 400 | Use dedicated endpoint |

### Endpoints

```
GET  /api/health
PUT  /api/users/me
GET  /api/users/me
GET  /api/users/me/games?limit=10&offset=0
GET  /api/users/me/active-game

POST   /api/matchmaking/join
DELETE /api/matchmaking/leave
GET    /api/matchmaking/status

POST /api/games
GET  /api/games/by-public/:publicId
GET  /api/games/:id
POST /api/games/join/:code
POST /api/games/:id/move
POST /api/games/:id/claim-abandoned
POST /api/games/:id/rematch
```

### Move Request/Response

```typescript
// Request
{ column: number }

// Response
{
  status: 'move_applied' | 'game_ended',
  reason?: 'CONNECT4' | 'BOARD_FULL',
  game: Game,
  move: Move
}
```

### Claim Abandoned Response

```typescript
{ game: Game }
```

---

## Real-Time Updates (Polling)

| Context | Endpoint | Interval |
|---------|----------|----------|
| Matchmaking | `GET /api/matchmaking/status` | 2s |
| Waiting for P2 | `GET /api/games/by-public/:publicId` | 2s |
| Active game | `GET /api/games/by-public/:publicId` | 2s |

### Frontend: Claim Win Button

```tsx
function ClaimWinButton({ game, myUserId, onClaim }: Props) {
  const isPlayer1 = myUserId === game.player1Id
  const opponentLastSeen = isPlayer1 ? game.player2LastSeen : game.player1LastSeen
  
  if (!opponentLastSeen) return null
  
  const timeSince = Date.now() - new Date(opponentLastSeen).getTime()
  if (timeSince < 30000) return null
  
  return (
    <button onClick={onClaim} className="bg-yellow-500 px-4 py-2 rounded-lg font-bold animate-pulse">
      Opponent Disconnected - Claim Win
    </button>
  )
}

// Handler
async function handleClaimWin() {
  const result = await api.claimAbandoned(gameId)
  updateGameState(result.game)
}
```

### Frontend: Move Handling

```typescript
async function makeMove(column: number) {
  try {
    const result = await api.move(gameId, column)
    updateGameState(result.game)
  } catch (error) {
    if (error.code === 'NOT_YOUR_TURN' || error.code === 'COLUMN_FULL') {
      const freshGame = await api.getGame(publicId)
      updateGameState(freshGame)
      showToast('Move failed - please try again')
    }
  }
}
```

---

## Cleanup Jobs

### Stale WAITING Games (every 5 min)

```typescript
async function cleanupStaleWaitingGames(): Promise<number> {
  const fifteenMinutesAgo = new Date(Date.now() - 15 * 60 * 1000)
  const result = await prisma.game.deleteMany({
    where: {
      status: 'WAITING',
      player1LastSeen: { lt: fifteenMinutesAgo },
    },
  })
  return result.count
}
```

### Stale ACTIVE Games (hourly)

```typescript
async function cleanupStaleActiveGames(): Promise<number> {
  const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000)
  const result = await prisma.game.deleteMany({
    where: {
      status: 'ACTIVE',
      updatedAt: { lt: twentyFourHoursAgo },
      ratingAppliedAt: null,
    },
  })
  return result.count
}
```

---

## Authentication

### Guest Username Generation

```typescript
const ADJECTIVES = ['Swift', 'Clever', 'Bold', 'Quick', 'Bright', 'Keen', 'Lucky', 'Happy', 'Brave', 'Calm', ...]
const NOUNS = ['Panda', 'Falcon', 'Tiger', 'Wolf', 'Eagle', 'Fox', 'Bear', 'Hawk', 'Lion', 'Lynx', ...]

function generateGuestUsername(): string {
  const adj = ADJECTIVES[Math.floor(Math.random() * ADJECTIVES.length)]
  const noun = NOUNS[Math.floor(Math.random() * NOUNS.length)]
  const num = Math.floor(Math.random() * 1000)
  return `${adj}${noun}${num}`
}
```

### Guest Warning (Login Screen)

> "Guest accounts are stored in this browser only. Clearing browser data will lose your account and history."

---

## Resolved Decisions

| Question | Decision |
|----------|----------|
| Matchmaking queue | Single instance, in-memory |
| Game ID | UUID + 8-char publicId |
| Rematch colors | Swap |
| Rematch Elo | Yes |
| Timer | No (v2) |
| Guest conversion | Not supported |
| Rate limiting | Skip v1 |
| Stale ACTIVE handling | Delete |
| Queue stale threshold | 30s |
| Elo source | Snapshots |
| Elo zero-sum | Enforced |
| Abandonment trigger | Dedicated endpoint |
| WAITING expiry | `player1LastSeen` |
| Race protection | `updateMany` with conditional where clauses |
| Terminal move | Atomic transaction |
| Rematch race | Optimistic lock on `rematchGameId` |

---

## Implementation Phases

### Phase 1: Foundation
- [ ] Monorepo scaffolding
- [ ] Railway: PostgreSQL + backend (single instance)
- [ ] Prisma schema + migration
- [ ] Express + health
- [ ] Firebase Auth
- [ ] Auth middleware
- [ ] `PUT /api/users/me`
- [ ] React + Firebase hook
- [ ] Login page

### Phase 2: Core Game
- [ ] `createGameWithPublicId` (tx-aware)
- [ ] Create private game
- [ ] Get game (with heartbeat)
- [ ] Join game (updateMany)
- [ ] **Move endpoint (atomic terminal)**
- [ ] **Claim abandoned endpoint**
- [ ] GameBoard component
- [ ] GamePage with polling
- [ ] ClaimWinButton

### Phase 3: Matchmaking
- [ ] Queue with mutex
- [ ] Join/leave/status
- [ ] 30s stale cleanup
- [ ] MatchmakingModal

### Phase 4: Polish
- [ ] **Rematch (optimistic lock)**
- [ ] Match history
- [ ] GameOverModal
- [ ] Animations
- [ ] Mobile responsive

### Phase 5: Hardening
- [ ] Error handling
- [ ] E2E tests
- [ ] Cleanup jobs
- [ ] Logging

---

## Critical Code Patterns Summary

### 1. Atomic Terminal Move
Move + finalize + rating updates in single transaction with one `updateMany`.

### 2. Rematch Optimistic Lock
```typescript
const linkResult = await tx.game.updateMany({
  where: { id: gameId, rematchGameId: null },
  data: { rematchGameId: newGame.id },
})
if (linkResult.count !== 1) {
  await tx.game.delete({ where: { id: newGame.id } })  // cleanup orphan
  // return existing rematch
}
```

### 3. Safe JSON Parsing
```typescript
function parseMoves(moves: unknown): Move[] {
  if (!Array.isArray(moves)) return []
  return moves as Move[]
}
```

### 4. Race Protection with updateMany
Use conditional `where` clauses in `updateMany` to prevent race conditions:
```typescript
const result = await tx.game.updateMany({
  where: {
    id: gameId,
    status: 'ACTIVE',
    currentTurn: playerNumber,
    ratingAppliedAt: null,  // ensures not already finalized
  },
  data: { ... }
})
if (result.count !== 1) {
  // Someone else modified the game first
}
```

---

## Future Enhancements (v2+)

- [ ] WebSockets
- [ ] Time controls
- [ ] Rating-based matchmaking
- [ ] Leaderboards
- [ ] Replay viewer
- [ ] Postgres-backed queue
- [ ] Rate limiting
- [ ] Spectator mode