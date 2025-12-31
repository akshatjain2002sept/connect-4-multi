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
          navigate(`/game/${result.publicId}`)
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
    <div
      className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fade-in"
      onClick={(e) => e.target === e.currentTarget && status !== 'joining' && handleCancel()}
    >
      <div className="bg-white rounded-2xl shadow-2xl max-w-sm w-full p-8 animate-scale-in">
        {status === 'joining' && (
          <div className="text-center">
            <div className="w-12 h-12 border-3 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-6" />
            <h3 className="text-xl font-semibold text-gray-800">Joining Queue</h3>
          </div>
        )}

        {status === 'queued' && (
          <div className="text-center">
            {/* Animated timer ring */}
            <div className="relative w-24 h-24 mx-auto mb-6">
              <svg className="w-full h-full transform -rotate-90">
                <circle
                  cx="48"
                  cy="48"
                  r="44"
                  stroke="currentColor"
                  strokeWidth="6"
                  fill="none"
                  className="text-gray-200"
                />
                <circle
                  cx="48"
                  cy="48"
                  r="44"
                  stroke="currentColor"
                  strokeWidth="6"
                  fill="none"
                  strokeLinecap="round"
                  className="text-blue-500 animate-pulse"
                  strokeDasharray="276.46"
                  strokeDashoffset="69"
                />
              </svg>
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="text-2xl font-mono font-semibold text-gray-800">
                  {formatTime(elapsedTime)}
                </span>
              </div>
            </div>
            <h3 className="text-xl font-semibold text-gray-800 mb-1">Finding Opponent</h3>
            <p className="text-gray-500 text-sm mb-8">Searching for a match...</p>
            <button
              onClick={handleCancel}
              className="w-full py-3 px-4 rounded-xl font-medium bg-gray-100 hover:bg-gray-200 text-gray-700 transition-all"
            >
              Cancel
            </button>
          </div>
        )}

        {status === 'matched' && (
          <div className="text-center py-4">
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
              <svg className="w-8 h-8 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h3 className="text-xl font-semibold text-green-600 mb-1">Match Found!</h3>
            <p className="text-gray-500 text-sm">Starting game...</p>
          </div>
        )}

        {status === 'error' && (
          <div className="text-center">
            <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-6">
              <svg className="w-8 h-8 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </div>
            <h3 className="text-xl font-semibold text-red-600 mb-1">Error</h3>
            <p className="text-gray-500 text-sm mb-6">{error}</p>
            <button
              onClick={onClose}
              className="w-full py-3 px-4 rounded-xl font-medium bg-gray-100 hover:bg-gray-200 text-gray-700 transition-all"
            >
              Close
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
