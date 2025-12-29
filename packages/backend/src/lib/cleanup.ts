import { prisma } from './db.js'

/**
 * Cleanup stale WAITING games (every 5 min)
 * Deletes games where player1 hasn't been seen in 15 minutes
 */
export async function cleanupStaleWaitingGames(): Promise<number> {
  const fifteenMinutesAgo = new Date(Date.now() - 15 * 60 * 1000)
  const result = await prisma.game.deleteMany({
    where: {
      status: 'WAITING',
      player1LastSeen: { lt: fifteenMinutesAgo }
    }
  })
  if (result.count > 0) {
    console.log(`Cleaned up ${result.count} stale WAITING games`)
  }
  return result.count
}

/**
 * Cleanup stale ACTIVE games (hourly)
 * Deletes games that haven't been updated in 24 hours and haven't been finalized
 */
export async function cleanupStaleActiveGames(): Promise<number> {
  const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000)
  const result = await prisma.game.deleteMany({
    where: {
      status: 'ACTIVE',
      updatedAt: { lt: twentyFourHoursAgo },
      ratingAppliedAt: null
    }
  })
  if (result.count > 0) {
    console.log(`Cleaned up ${result.count} stale ACTIVE games`)
  }
  return result.count
}

/**
 * Start cleanup jobs
 */
export function startCleanupJobs(): void {
  // Cleanup stale WAITING games every 5 minutes
  setInterval(async () => {
    try {
      await cleanupStaleWaitingGames()
    } catch (error) {
      console.error('Error cleaning up stale WAITING games:', error)
    }
  }, 5 * 60 * 1000)

  // Cleanup stale ACTIVE games every hour
  setInterval(async () => {
    try {
      await cleanupStaleActiveGames()
    } catch (error) {
      console.error('Error cleaning up stale ACTIVE games:', error)
    }
  }, 60 * 60 * 1000)

  console.log('Cleanup jobs started')
}
