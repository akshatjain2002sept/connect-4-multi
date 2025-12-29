import { useEffect, useRef, useCallback } from 'react'

interface UsePollingOptions {
  enabled?: boolean
  interval?: number
  onError?: (error: Error) => void
}

export function usePolling<T>(
  fetchFn: () => Promise<T>,
  onData: (data: T) => void,
  options: UsePollingOptions = {}
) {
  const { enabled = true, interval = 2000, onError } = options
  const timeoutRef = useRef<ReturnType<typeof setTimeout>>()
  const mountedRef = useRef(true)

  const poll = useCallback(async () => {
    if (!mountedRef.current || !enabled) return

    try {
      const data = await fetchFn()
      if (mountedRef.current) {
        onData(data)
      }
    } catch (err) {
      if (mountedRef.current && onError) {
        onError(err instanceof Error ? err : new Error(String(err)))
      }
    }

    if (mountedRef.current && enabled) {
      timeoutRef.current = setTimeout(poll, interval)
    }
  }, [fetchFn, onData, enabled, interval, onError])

  useEffect(() => {
    mountedRef.current = true

    if (enabled) {
      poll()
    }

    return () => {
      mountedRef.current = false
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
      }
    }
  }, [poll, enabled])

  const refresh = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current)
    }
    poll()
  }, [poll])

  return { refresh }
}
