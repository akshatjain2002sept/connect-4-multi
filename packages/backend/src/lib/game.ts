import { PrismaClient, Prisma, Game } from '@prisma/client'
import { Move, BOARD_SIZE, ABANDON_THRESHOLD_MS } from '@connect4/shared'

// Base32 characters (excluding I, O, 0, 1 to avoid confusion)
const BASE32_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'

/**
 * Generate an 8-character base32 public ID
 */
export function generatePublicId(): string {
  let id = ''
  for (let i = 0; i < 8; i++) {
    id += BASE32_CHARS[Math.floor(Math.random() * BASE32_CHARS.length)]
  }
  return id
}

/**
 * Generate a 6-character game code for private games
 */
export function generateGameCode(): string {
  let code = ''
  for (let i = 0; i < 6; i++) {
    code += BASE32_CHARS[Math.floor(Math.random() * BASE32_CHARS.length)]
  }
  return code
}

/**
 * Create a game with a unique publicId (retry on collision)
 */
export async function createGameWithPublicId(
  db: PrismaClient | Prisma.TransactionClient,
  data: Omit<Prisma.GameCreateInput, 'publicId'>
): Promise<Game> {
  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      return await db.game.create({
        data: { ...data, publicId: generatePublicId() }
      })
    } catch (e: unknown) {
      const error = e as { code?: string; meta?: { target?: string[] } }
      if (error.code === 'P2002' && error.meta?.target?.includes('publicId')) continue
      throw e
    }
  }
  throw new Error('Failed to generate unique publicId')
}

// Board validation
export function assertValidBoard(board: string): void {
  if (board.length !== BOARD_SIZE) {
    throw new Error(`Invalid board length: ${board.length}, expected ${BOARD_SIZE}`)
  }
  if (!/^[012]{42}$/.test(board)) {
    throw new Error('Invalid board characters')
  }
}

/**
 * Find the lowest empty row in a column
 * Returns null if column is full or invalid
 */
export function findDropRow(board: string, column: number): number | null {
  if (column < 0 || column > 6) return null
  for (let row = 5; row >= 0; row--) {
    if (board[row * 7 + column] === '0') return row
  }
  return null
}

/**
 * Apply a move to the board
 * Returns null if the move is invalid
 */
export function applyMove(
  board: string,
  column: number,
  player: 1 | 2
): { newBoard: string; row: number } | null {
  assertValidBoard(board)
  const row = findDropRow(board, column)
  if (row === null) return null
  const index = row * 7 + column
  const newBoard = board.substring(0, index) + player.toString() + board.substring(index + 1)
  assertValidBoard(newBoard)
  return { newBoard, row }
}

// Direction vectors for checking wins
const DIRECTIONS = [
  { dr: 0, dc: 1 },  // horizontal
  { dr: 1, dc: 0 },  // vertical
  { dr: 1, dc: 1 },  // diagonal down-right
  { dr: 1, dc: -1 }, // diagonal down-left
]

/**
 * Check if the last move at (row, col) creates a winning connection
 */
export function checkWin(board: string, row: number, col: number, player: string): boolean {
  for (const { dr, dc } of DIRECTIONS) {
    let count = 1
    // Check in positive direction
    for (let i = 1; i < 4; i++) {
      const r = row + dr * i
      const c = col + dc * i
      if (r < 0 || r > 5 || c < 0 || c > 6 || board[r * 7 + c] !== player) break
      count++
    }
    // Check in negative direction
    for (let i = 1; i < 4; i++) {
      const r = row - dr * i
      const c = col - dc * i
      if (r < 0 || r > 5 || c < 0 || c > 6 || board[r * 7 + c] !== player) break
      count++
    }
    if (count >= 4) return true
  }
  return false
}

/**
 * Check if the board is completely full (draw condition)
 */
export function isBoardFull(board: string): boolean {
  return !board.includes('0')
}

/**
 * Safely parse moves JSON from database
 */
export function parseMoves(moves: unknown): Move[] {
  if (!Array.isArray(moves)) {
    console.warn('Invalid moves format, defaulting to empty array')
    return []
  }
  return moves as Move[]
}

// Elo calculation (K-factor = 32)
const K_FACTOR = 32

/**
 * Calculate Elo change for a win/loss (zero-sum)
 */
export function calculateEloChange(
  winnerRating: number,
  loserRating: number
): { winnerDelta: number; loserDelta: number } {
  const expected = 1 / (1 + Math.pow(10, (loserRating - winnerRating) / 400))
  const winnerDelta = Math.round(K_FACTOR * (1 - expected))
  return { winnerDelta, loserDelta: -winnerDelta }
}

/**
 * Calculate Elo change for a draw (zero-sum)
 */
export function calculateEloDraw(
  rating1: number,
  rating2: number
): { delta1: number; delta2: number } {
  const expected1 = 1 / (1 + Math.pow(10, (rating2 - rating1) / 400))
  const delta1 = Math.round(K_FACTOR * (0.5 - expected1))
  return { delta1, delta2: -delta1 }
}

/**
 * Check if opponent has abandoned the game
 */
export function checkAbandonment(
  game: { status: string; player1Id: string; player2Id: string | null; player1LastSeen: Date | null; player2LastSeen: Date | null },
  requestingUserId: string
): 'none' | 'opponent_abandoned' {
  if (game.status !== 'ACTIVE' || !game.player2Id) return 'none'

  const isPlayer1 = requestingUserId === game.player1Id
  const opponentLastSeen = isPlayer1 ? game.player2LastSeen : game.player1LastSeen

  if (!opponentLastSeen) return 'none'
  if (Date.now() - opponentLastSeen.getTime() > ABANDON_THRESHOLD_MS) {
    return 'opponent_abandoned'
  }
  return 'none'
}

/**
 * Get active game for a user (WAITING or ACTIVE)
 */
export async function getActiveGameForUser(
  db: PrismaClient | Prisma.TransactionClient,
  userId: string
): Promise<Game | null> {
  return db.game.findFirst({
    where: {
      OR: [{ player1Id: userId }, { player2Id: userId }],
      status: { in: ['WAITING', 'ACTIVE'] }
    }
  })
}
