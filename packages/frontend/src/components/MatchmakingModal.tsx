import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../lib/api'
import { usePolling } from '../hooks/usePolling'

interface MatchmakingModalProps {
  onClose: () => void
}

export function MatchmakingModal({ onClose }: MatchmakingModalProps) {
  const navigate = useNavigate()
  const [status, setStatus] = useState<'joining' | 'queued' | 'matched' | 'error'>('joining')
  const [error, setError] = useState<string | null>(null)
  const [queuedAt, setQueuedAt] = useState<Date | null>(null)
  const [elapsedTime, setElapsedTime] = useState(0)

  const checkStatus = useCallback(async () => {
    const result = await api.getMatchmakingStatus()
    if (result.status === 'matched') {
      setStatus('matched')
      navigate(`/game/${result.publicId}`)
    } else if (result.status === 'queued') {
      setQueuedAt(new Date(result.queuedAt))
    }
    return result
  }, [navigate])

  const { refresh } = usePolling(
    checkStatus,
    () => {},
    {
      enabled: status === 'queued',
      interval: 2000,
    }
  )

  useEffect(() => {
    const joinQueue = async () => {
      try {
        const result = await api.joinMatchmaking()
        if (result.status === 'matched') {
          setStatus('matched')
          navigate(`/game/${result.publicId}`)
        } else if (result.status === 'queued' || result.status === 'already_queued') {
          setStatus('queued')
          setQueuedAt(new Date())
        } else if (result.status === 'has_active_game') {
          navigate(`/game/${result.gameId}`)
        }
      } catch (err) {
        setStatus('error')
        setError('Failed to join matchmaking queue')
      }
    }

    joinQueue()
  }, [navigate])

  useEffect(() => {
    if (!queuedAt) return

    const interval = setInterval(() => {
      setElapsedTime(Math.floor((Date.now() - queuedAt.getTime()) / 1000))
    }, 1000)

    return () => clearInterval(interval)
  }, [queuedAt])

  const handleCancel = async () => {
    try {
      await api.leaveMatchmaking()
    } catch {
      // Ignore errors when leaving
    }
    onClose()
  }

  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-sm w-full p-6">
        {status === 'joining' && (
          <div className="text-center">
            <div className="animate-spin w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full mx-auto mb-4" />
            <h3 className="text-xl font-bold text-gray-800">Joining Queue...</h3>
          </div>
        )}

        {status === 'queued' && (
          <div className="text-center">
            <div className="relative w-20 h-20 mx-auto mb-4">
              <div className="absolute inset-0 border-4 border-blue-200 rounded-full" />
              <div className="absolute inset-0 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="text-lg font-bold text-blue-600">{formatTime(elapsedTime)}</span>
              </div>
            </div>
            <h3 className="text-xl font-bold text-gray-800 mb-2">Finding Opponent...</h3>
            <p className="text-gray-500 mb-6">Searching for a match</p>
            <button
              onClick={handleCancel}
              className="w-full py-3 px-4 rounded-xl font-semibold bg-gray-200 hover:bg-gray-300 text-gray-700 transition"
            >
              Cancel
            </button>
          </div>
        )}

        {status === 'matched' && (
          <div className="text-center">
            <div className="text-4xl mb-4">🎮</div>
            <h3 className="text-xl font-bold text-green-600">Match Found!</h3>
            <p className="text-gray-500">Redirecting to game...</p>
          </div>
        )}

        {status === 'error' && (
          <div className="text-center">
            <div className="text-4xl mb-4">❌</div>
            <h3 className="text-xl font-bold text-red-600 mb-2">Error</h3>
            <p className="text-gray-500 mb-6">{error}</p>
            <button
              onClick={onClose}
              className="w-full py-3 px-4 rounded-xl font-semibold bg-gray-200 hover:bg-gray-300 text-gray-700 transition"
            >
              Close
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
