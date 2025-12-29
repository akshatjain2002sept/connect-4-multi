# Connect 4 Multiplayer

A web-based Connect 4 game with real-time multiplayer, user authentication, and Elo rating system.

## Tech Stack

- **Frontend**: React + Vite + Tailwind CSS
- **Backend**: Express.js (Node.js)
- **Database**: PostgreSQL + Prisma ORM
- **Auth**: Firebase Auth (Google OAuth + Guest/Anonymous)
- **Deployment**: Railway (backend + database), Vercel (frontend)

## Project Structure

```
connect-4-multi/
├── packages/
│   ├── frontend/     # React app (Vite)
│   ├── backend/      # Express API server
│   └── shared/       # Shared types and utilities
├── .env.example      # Root environment template
└── pnpm-workspace.yaml
```

## Prerequisites

- Node.js 20.x or later
- pnpm 8.x or later
- PostgreSQL database (local or Railway)
- Firebase project with Auth enabled

## Getting Started

### 1. Install Dependencies

```bash
pnpm install
```

### 2. Set Up Firebase

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Create a new project (or use existing)
3. Enable Authentication:
   - Go to **Authentication** > **Sign-in method**
   - Enable **Google** provider
   - Enable **Anonymous** provider
4. Get your web app config:
   - Go to **Project Settings** > **General** > **Your apps**
   - Click "Add app" > Web
   - Copy the Firebase config values
5. Generate service account credentials (for backend):
   - Go to **Project Settings** > **Service accounts**
   - Click "Generate new private key"
   - Save the JSON file securely (do NOT commit to git)

### 3. Set Up PostgreSQL

**Option A: Local PostgreSQL**
```bash
# Create database
createdb connect4

# Set DATABASE_URL in .env
DATABASE_URL="postgresql://user:password@localhost:5432/connect4"
```

**Option B: Railway PostgreSQL**
1. Go to [Railway](https://railway.app/)
2. Create a new project
3. Add PostgreSQL service
4. Copy the `DATABASE_URL` from the service variables

### 4. Configure Environment Variables

Copy the example files and fill in your values:

```bash
# Root .env (contains all variables)
cp .env.example .env

# Or for frontend only
cp packages/frontend/.env.example packages/frontend/.env.local
```

**Required Environment Variables:**

| Variable | Description | Where to Get |
|----------|-------------|--------------|
| `DATABASE_URL` | PostgreSQL connection string | Railway or local setup |
| `FIREBASE_PROJECT_ID` | Firebase project ID | Firebase Console |
| `VITE_FIREBASE_API_KEY` | Firebase API key | Firebase Console |
| `VITE_FIREBASE_AUTH_DOMAIN` | Firebase auth domain | Firebase Console |
| `VITE_FIREBASE_PROJECT_ID` | Firebase project ID | Firebase Console |
| `VITE_FIREBASE_STORAGE_BUCKET` | Firebase storage bucket | Firebase Console |
| `VITE_FIREBASE_MESSAGING_SENDER_ID` | Firebase messaging sender ID | Firebase Console |
| `VITE_FIREBASE_APP_ID` | Firebase app ID | Firebase Console |

### 5. Initialize Database

```bash
# Generate Prisma client
pnpm --filter backend db:generate

# Run migrations
pnpm --filter backend db:migrate

# (Optional) Open Prisma Studio to view data
pnpm --filter backend db:studio
```

### 6. Start Development Servers

```bash
# Start both frontend and backend
pnpm dev

# Or start individually
pnpm dev:frontend  # http://localhost:5173
pnpm dev:backend   # http://localhost:3001
```

## Deployment

### Backend (Railway)

1. Connect your GitHub repo to Railway
2. Set the root directory to `packages/backend`
3. Add environment variables in Railway dashboard:
   - `DATABASE_URL` (auto-injected if using Railway PostgreSQL)
   - `FIREBASE_PROJECT_ID`
   - `NODE_ENV=production`
4. **CRITICAL**: Lock instance count to 1 (required for in-memory matchmaking queue)
   - Go to Service Settings > Scaling > Set replicas to 1

### Frontend (Vercel)

1. Connect your GitHub repo to Vercel
2. Set the root directory to `packages/frontend`
3. Add environment variables in Vercel dashboard (all `VITE_*` variables)
4. Set build command: `pnpm build`
5. Set output directory: `dist`

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/health` | Health check |
| PUT | `/api/users/me` | Upsert current user |
| GET | `/api/users/me` | Get current user profile |
| GET | `/api/users/me/active-game` | Get user's active game |
| POST | `/api/games` | Create private game |
| POST | `/api/games/join/:code` | Join game by code |
| GET | `/api/games/:id` | Get game by ID |
| GET | `/api/games/by-public/:publicId` | Get game by public ID |
| POST | `/api/games/:id/move` | Make a move |
| POST | `/api/games/:id/claim-abandoned` | Claim win on abandonment |
| POST | `/api/games/:id/rematch` | Request/accept rematch |
| POST | `/api/matchmaking/join` | Join matchmaking queue |
| DELETE | `/api/matchmaking/leave` | Leave matchmaking queue |
| GET | `/api/matchmaking/status` | Get queue status |

## Game Rules

- Standard Connect 4 rules: first to connect 4 pieces horizontally, vertically, or diagonally wins
- Elo rating system (K-factor = 32, zero-sum)
- 30-second abandonment timeout
- Rematch swaps player colors

## Development

```bash
# Type checking
pnpm typecheck

# Linting
pnpm lint

# Build for production
pnpm build
```

## License

MIT
