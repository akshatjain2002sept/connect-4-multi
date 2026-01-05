/**
 * API Error codes as specified in Spec.md
 */
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
  | 'NOT_GAME_CREATOR'
  | 'OPPONENT_ALREADY_JOINED'

const ERROR_STATUS_CODES: Record<ApiErrorCode, number> = {
  UNAUTHORIZED: 401,
  USER_NOT_FOUND: 404,
  GAME_NOT_FOUND: 404,
  GAME_NOT_ACTIVE: 409,
  GAME_NOT_FINISHED: 409,
  GAME_NOT_STARTED: 409,
  GAME_ALREADY_STARTED: 409,
  NOT_YOUR_TURN: 403,
  NOT_IN_GAME: 403,
  CANNOT_JOIN_OWN_GAME: 400,
  HAS_ACTIVE_GAME: 409,
  INVALID_COLUMN: 400,
  COLUMN_FULL: 400,
  INVALID_CODE_FORMAT: 400,
  ALREADY_QUEUED: 409,
  NOT_QUEUED: 400,
  OPPONENT_NOT_ABANDONED: 400,
  USE_CLAIM_ABANDONED_ENDPOINT: 400,
  MOVE_CONFLICT: 409,
  USERNAME_TAKEN: 409,
  INVALID_USERNAME: 400,
  NOT_GAME_CREATOR: 403,
  OPPONENT_ALREADY_JOINED: 409,
}

export class ApiError extends Error {
  readonly code: ApiErrorCode
  readonly statusCode: number

  constructor(code: ApiErrorCode, message?: string) {
    super(message || code)
    this.code = code
    this.statusCode = ERROR_STATUS_CODES[code]
    this.name = 'ApiError'
  }

  toJSON() {
    return {
      error: this.code,
      message: this.message,
    }
  }
}
