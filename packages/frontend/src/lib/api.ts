import { getIdToken } from './firebase'
import type {
  GameStatus,
  GameResult,
  EndReason,
  Move,
  User as SharedUser,
  Game as SharedGame,
  ApiErrorCode,
} from '../shared/index.js'

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api'

// Extended User type with firebaseUid for auth matching
export interface User extends SharedUser {
  firebaseUid?: string
}

// Extended Game type with full player objects
export interface Game {
  id: string
  publicId: string
  code: string | null
  status: GameStatus
  board: string
  currentTurn: 1 | 2
  moves: Move[]
  player1: User
  player1Id?: string
  player2: User | null
  player2Id?: string | null
  result: GameResult | null
  endedReason: EndReason | null
  winnerId: string | null
  p1RatingBefore: number | null
  p2RatingBefore: number | null
  p1RatingDelta: number | null
  p2RatingDelta: number | null
  player1LastSeen: string | null
  player2LastSeen: string | null
  rematchRequestedBy: 1 | 2 | null
  rematchGameId: string | null
  rematchPublicId: string | null
  createdAt: string
  updatedAt: string
  completedAt: string | null
}

export interface ApiError {
  code: ApiErrorCode | string
  message?: string
}

export type { GameStatus, GameResult, EndReason, Move }

class ApiClient {
  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const token = await getIdToken()

    const headers: HeadersInit = {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    }

    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
      ...options,
      headers,
    })

    if (!response.ok) {
      const error = await response.json().catch(() => ({ code: 'UNKNOWN_ERROR' }))
      throw error as ApiError
    }

    return response.json()
  }

  // User endpoints
  async getMe(): Promise<User> {
    return this.request<User>('/users/me')
  }

  async updateMe(data: { username?: string }): Promise<User> {
    return this.request<User>('/users/me', {
      method: 'PUT',
      body: JSON.stringify(data),
    })
  }

  async getActiveGame(): Promise<Game | null> {
    try {
      const response = await this.request<{ activeGame: Game | null }>('/users/me/active-game')
      return response.activeGame
    } catch (err) {
      const error = err as ApiError
      if (error.code === 'GAME_NOT_FOUND') return null
      throw err
    }
  }

  async getGameHistory(limit = 10, offset = 0): Promise<{ games: Game[]; total: number }> {
    return this.request<{ games: Game[]; total: number }>(
      `/users/me/games?limit=${limit}&offset=${offset}`
    )
  }

  // Game endpoints
  async createPrivateGame(): Promise<Game> {
    return this.request<Game>('/games', { method: 'POST' })
  }

  async getGameByPublicId(publicId: string): Promise<Game> {
    return this.request<Game>(`/games/by-public/${publicId}`)
  }

  async getGame(id: string): Promise<Game> {
    return this.request<Game>(`/games/${id}`)
  }

  async joinGame(code: string): Promise<{ gameId: string; publicId: string }> {
    return this.request<{ gameId: string; publicId: string }>(`/games/join/${code}`, {
      method: 'POST',
    })
  }

  async makeMove(
    gameId: string,
    column: number
  ): Promise<{
    status: 'move_applied' | 'game_ended'
    reason?: EndReason
    game: Game
    move: Move
  }> {
    return this.request(`/games/${gameId}/move`, {
      method: 'POST',
      body: JSON.stringify({ column }),
    })
  }

  async claimAbandoned(gameId: string): Promise<{ game: Game }> {
    return this.request<{ game: Game }>(`/games/${gameId}/claim-abandoned`, {
      method: 'POST',
    })
  }

  async resign(gameId: string): Promise<{ game: Game }> {
    return this.request<{ game: Game }>(`/games/${gameId}/resign`, {
      method: 'POST',
    })
  }

  async cancelGame(gameId: string): Promise<{ success: boolean }> {
    return this.request<{ success: boolean }>(`/games/${gameId}/cancel`, {
      method: 'POST',
    })
  }

  async requestRematch(
    gameId: string
  ): Promise<{ status: 'requested' } | { status: 'accepted'; newGameId: string; newPublicId: string }> {
    return this.request(`/games/${gameId}/rematch`, { method: 'POST' })
  }

  // Matchmaking endpoints
  async joinMatchmaking(): Promise<
    | { status: 'queued' }
    | { status: 'already_queued' }
    | { status: 'has_active_game'; gameId: string; publicId: string }
    | { status: 'matched'; gameId: string; publicId: string }
  > {
    return this.request('/matchmaking/join', { method: 'POST' })
  }

  async leaveMatchmaking(): Promise<{ status: 'left' | 'not_queued' }> {
    return this.request('/matchmaking/leave', { method: 'DELETE' })
  }

  async getMatchmakingStatus(): Promise<
    | { status: 'queued'; queuedAt: string }
    | { status: 'not_queued' }
    | { status: 'matched'; gameId: string; publicId: string }
  > {
    return this.request('/matchmaking/status')
  }
}

export const api = new ApiClient()
