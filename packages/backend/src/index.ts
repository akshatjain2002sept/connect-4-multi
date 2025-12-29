import express from 'express'
import cors from 'cors'
import { authMiddleware } from './middleware/auth.js'
import type { AuthenticatedRequest } from './middleware/auth.js'
import { errorHandler } from './middleware/errorHandler.js'
import userRoutes from './routes/users.js'
import gameRoutes from './routes/games.js'
import matchmakingRoutes from './routes/matchmaking.js'
import { startCleanupJobs } from './lib/cleanup.js'

const app = express()
const PORT = process.env.PORT || 3001

app.use(cors())
app.use(express.json())

// Health check endpoint (no auth required)
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() })
})

// API routes
app.use('/api/users', userRoutes)
app.use('/api/games', gameRoutes)
app.use('/api/matchmaking', matchmakingRoutes)

// Error handler (must be last)
app.use(errorHandler)

app.listen(PORT, () => {
  console.log(`Backend server running on port ${PORT}`)

  // Start cleanup jobs
  startCleanupJobs()
})

export { authMiddleware, AuthenticatedRequest }
