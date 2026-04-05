<div align="center">
  

  # VITRA AI

  **A full-stack AI digital twin platform for conversations, behavior tracking, memory, and personalized insights.**

  [Live Demo](https://vitra-ai.vercel.app) • [Backend API](https://vitra-backend.onrender.com) • [AI Studio App](https://ai.studio/apps/d7637624-97e4-4c0f-86b9-82e608e5d698)
</div>

## Overview
VITRA AI is a full-stack application that lets a user create a personal AI digital twin, chat with it, track daily behavior, connect external services, and generate AI-powered insights from memory and activity data.

The project includes:
- A `React + Vite + TypeScript` frontend
- An `Express + TypeScript + MongoDB` backend
- Gemini-powered AI features for chat, recommendations, summaries, and profile enrichment
- Google authentication and connector flows
- Spotify and Google Calendar integrations

## Features
- Secure authentication with email/password and Google sign-in
- Personalized digital twin setup with tone, personality, goals, and knowledge
- Real-time style chat experience with persistent sessions
- Daily behavior tracking for sleep, work, study, mood, and notes
- AI-generated behavioral insights and recommendations
- Google Calendar and Spotify connector support
- Password reset with OTP email flow
- Production-ready split deployment for frontend and backend

## Live Links
- Frontend: `https://vitra-ai.vercel.app`
- Backend: `https://vitra-backend.onrender.com`
- AI Studio: `https://ai.studio/apps/d7637624-97e4-4c0f-86b9-82e608e5d698`

## Tech Stack
- Frontend: `React 19`, `Vite`, `TypeScript`, `Tailwind CSS`, `React Router`
- Backend: `Node.js`, `Express`, `TypeScript`, `Socket.IO`
- Database: `MongoDB`, `Mongoose`
- AI: `Google Gemini`
- Auth and Integrations: `Google OAuth`, `Spotify API`, `Nodemailer`
- Deployment: `Vercel` for frontend, `Render` for backend

## Project Structure
```text
VITRA/
├─ frontend/
│  ├─ src/
│  │  ├─ components/        # Reusable UI pieces like calendar, Spotify, tutorial, error boundary
│  │  ├─ context/           # Auth, tutorial, and toast providers
│  │  ├─ pages/             # Landing, login, register, setup, chat, dashboard, insights, tracker
│  │  ├─ services/          # Gemini and local AI service clients
│  │  ├─ App.tsx            # App routes and providers
│  │  ├─ constants.ts       # Frontend environment-backed constants
│  │  └─ main.tsx           # React entry point
│  ├─ .env.example          # Frontend environment template
│  ├─ index.html
│  ├─ package.json
│  └─ vite.config.ts
├─ server/
│  ├─ config/               # Database config
│  ├─ controllers/          # Route controller logic
│  ├─ middleware/           # Auth and DB middleware
│  ├─ models/               # Mongoose models
│  ├─ routes/               # Express route definitions
│  ├─ services/             # Connector-related service logic
│  ├─ package.json
│  └─ server.ts             # Express app entry point
├─ .env.example             # Root/backend environment template
├─ .env.local               # Local development environment file
├─ package.json             # Root scripts for running frontend + backend together
└─ README.md
```

## Important Files
- [package.json](/abs/path/c:/Users/sanke/Downloads/VITRA/package.json): root scripts for local development
- [frontend/package.json](/abs/path/c:/Users/sanke/Downloads/VITRA/frontend/package.json): frontend dependencies and build scripts
- [server/package.json](/abs/path/c:/Users/sanke/Downloads/VITRA/server/package.json): backend runtime and dev scripts
- [frontend/src/constants.ts](/abs/path/c:/Users/sanke/Downloads/VITRA/frontend/src/constants.ts): API base URL and frontend constants
- [frontend/src/context/AuthContext.tsx](/abs/path/c:/Users/sanke/Downloads/VITRA/frontend/src/context/AuthContext.tsx): auth flow and token handling
- [server/server.ts](/abs/path/c:/Users/sanke/Downloads/VITRA/server/server.ts): backend server bootstrap and route mounting
- [server/controllers/authController.ts](/abs/path/c:/Users/sanke/Downloads/VITRA/server/controllers/authController.ts): login, register, Google auth, password reset

## Local Development
### Prerequisites
- `Node.js 18+`
- `npm`
- `MongoDB Atlas` connection string or a MongoDB instance

### 1. Clone the repository
```bash
git clone https://github.com/designersanket/VITRA-AI.git
cd VITRA-AI
```

### 2. Install dependencies
```bash
npm install
npm run install:all
```

### 3. Configure environment variables
Create your local environment file at the project root:

```bash
cp .env.example .env.local
```

Set the required values in `.env.local`.

Example:
```env
MONGODB_URI=your_mongodb_uri
JWT_SECRET=your_jwt_secret
GEMINI_API_KEY=your_gemini_api_key
GOOGLE_CLIENT_ID=your_google_client_id
GOOGLE_CLIENT_SECRET=your_google_client_secret
VITE_GOOGLE_CLIENT_ID=your_google_client_id
APP_URL=http://localhost:5173
EMAIL_USER=your_email@gmail.com
EMAIL_PASS=your_app_password
EMAIL_FROM="VITRA Support <your_email@gmail.com>"
SPOTIFY_CLIENT_ID=your_spotify_client_id
SPOTIFY_CLIENT_SECRET=your_spotify_client_secret
```

For the frontend, also ensure:

```env
VITE_API_URL=http://localhost:3000
```

You can place that in `frontend/.env` or in your frontend deployment environment.

### 4. Start the app
```bash
npm run dev
```

This runs:
- Frontend on `http://localhost:5173`
- Backend on `http://localhost:3000`

## Available Scripts
From the project root:

```bash
npm run dev
npm run install:all
npm run build
npm run start
```

From `frontend/`:

```bash
npm run dev
npm run build
npm run preview
```

From `server/`:

```bash
npm run dev
npm run start
```

## Environment Variables
### Root / Backend
- `MONGODB_URI`
- `JWT_SECRET`
- `GEMINI_API_KEY`
- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`
- `APP_URL`
- `EMAIL_SERVICE`
- `EMAIL_USER`
- `EMAIL_PASS`
- `EMAIL_FROM`
- `SPOTIFY_CLIENT_ID`
- `SPOTIFY_CLIENT_SECRET`

### Frontend
- `VITE_API_URL`
- `VITE_GOOGLE_CLIENT_ID`
- `VITE_GEMINI_API_KEY` if you are using Gemini directly from the frontend

## Production Deployment
### Frontend on Vercel
Use these settings:
- Root Directory: `frontend`
- Build Command: `npm run build`
- Output Directory: `dist`

Frontend environment variables:
```env
VITE_API_URL=https://vitra-backend.onrender.com
VITE_GOOGLE_CLIENT_ID=your_google_client_id
```

### Backend on Render
Backend environment variables:
```env
APP_URL=https://vitra-ai.vercel.app
MONGODB_URI=your_mongodb_uri
JWT_SECRET=your_jwt_secret
GEMINI_API_KEY=your_gemini_api_key
GOOGLE_CLIENT_ID=your_google_client_id
GOOGLE_CLIENT_SECRET=your_google_client_secret
SPOTIFY_CLIENT_ID=your_spotify_client_id
SPOTIFY_CLIENT_SECRET=your_spotify_client_secret
EMAIL_USER=your_email@gmail.com
EMAIL_PASS=your_app_password
EMAIL_FROM="VITRA Support <your_email@gmail.com>"
```

## Google OAuth Setup
### Authorized JavaScript origins
- `http://localhost:5173`
- `http://localhost`
- `https://vitra-ai.vercel.app`

### Authorized redirect URIs
- `http://localhost:5173`
- `http://localhost:5173/login`
- `https://vitra-ai.vercel.app/login`
- `https://vitra-backend.onrender.com/api/connect/google/callback`

## Notes
- The frontend uses `VITE_API_URL` in production to reach the backend API.
- If you see JSON parsing errors during login, the frontend is usually pointing at the wrong server.
- Render cold starts may briefly return a warm-up response before the backend is fully ready.

## Roadmap Ideas
- Better code splitting for smaller frontend bundles
- Cleaner monorepo deployment configuration
- Automated tests for auth and API flows
- Improved connector status UX and retry handling
- Richer memory analytics and export tools

## License
This project is currently unlicensed. Add a license before public distribution if needed.
