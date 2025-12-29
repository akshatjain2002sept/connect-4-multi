import { Request, Response, NextFunction } from 'express'
import { ApiError } from '../lib/errors.js'

/**
 * Global error handler middleware
 * Converts ApiError instances to proper JSON responses
 */
export function errorHandler(
  err: Error,
  _req: Request,
  res: Response,
  _next: NextFunction
): void {
  if (err instanceof ApiError) {
    res.status(err.statusCode).json(err.toJSON())
    return
  }

  // Log unexpected errors
  console.error('Unexpected error:', err)

  res.status(500).json({
    error: 'INTERNAL_ERROR',
    message: process.env.NODE_ENV === 'production' ? 'Internal server error' : err.message,
  })
}
