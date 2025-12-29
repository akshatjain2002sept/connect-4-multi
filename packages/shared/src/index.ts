// Connect 4 Shared Types and Utilities

// Game Status
export type GameStatus = 'WAITING' | 'ACTIVE' | 'COMPLETED' | 'ABANDONED'

// Game Result
export type GameResult = 'P1_WIN' | 'P2_WIN' | 'DRAW'

// End Reason
export type EndReason = 'CONNECT4' | 'BOARD_FULL' | 'ABANDONED'

// Move interface
export interface Move {
  moveNumber: number
  column: number
  row: number
  player: 1 | 2
  userId: string
  ts: string
}

// User interface (API response)
export interface User {
  id: string
  username: string
  email?: string | null
  isGuest: boolean
  rating: number
  wins: number
  losses: number
  draws: number
  createdAt: string
}

// Player info (embedded in game response)
export interface PlayerInfo {
  id: string
  username: string
  rating: number
}

// Game interface (API response)
export interface Game {
  id: string
  publicId: string
  code?: string | null
  status: GameStatus
  board: string
  currentTurn: 1 | 2
  moves: Move[]
  player1: PlayerInfo
  player2?: PlayerInfo | null
  result?: GameResult | null
  endedReason?: EndReason | null
  winnerId?: string | null
  p1RatingBefore?: number | null
  p2RatingBefore?: number | null
  p1RatingDelta?: number | null
  p2RatingDelta?: number | null
  player1LastSeen?: string | null
  player2LastSeen?: string | null
  rematchRequestedBy?: 1 | 2 | null
  rematchGameId?: string | null
  createdAt: string
  updatedAt: string
  completedAt?: string | null
}

// API Error codes
export type ApiErrorCode =
  | 'UNAUTHORIZED'
  | 'USER_NOT_FOUND'
  | 'GAME_NOT_FOUND'
  | 'GAME_NOT_ACTIVE'
  | 'GAME_NOT_FINISHED'
  | 'GAME_NOT_STARTED'
  | 'GAME_ALREADY_STARTED'
  | 'NOT_YOUR_TURN'
  | 'NOT_IN_GAME'
  | 'CANNOT_JOIN_OWN_GAME'
  | 'HAS_ACTIVE_GAME'
  | 'INVALID_COLUMN'
  | 'COLUMN_FULL'
  | 'INVALID_CODE_FORMAT'
  | 'ALREADY_QUEUED'
  | 'NOT_QUEUED'
  | 'OPPONENT_NOT_ABANDONED'
  | 'USE_CLAIM_ABANDONED_ENDPOINT'
  | 'MOVE_CONFLICT'
  | 'USERNAME_TAKEN'
  | 'INVALID_USERNAME'

// API Error response
export interface ApiErrorResponse {
  error: ApiErrorCode
  message: string
}

// Board dimensions
export const BOARD_ROWS = 6
export const BOARD_COLS = 7
export const BOARD_SIZE = BOARD_ROWS * BOARD_COLS

// Empty board string
export const EMPTY_BOARD = '0'.repeat(BOARD_SIZE)

// Abandonment threshold in milliseconds
export const ABANDON_THRESHOLD_MS = 30 * 1000
