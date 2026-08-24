# AGENTS.md

This repository is a small full-stack app with a Node/Express backend and a React + Vite frontend.

## Quick start

- Backend:
  - `cd backend`
  - `npm install`
  - `npm run dev`
- Frontend:
  - `cd frontend`
  - `npm install`
  - `npm run dev`
- Frontend production build:
  - `cd frontend && npm run build`
- Frontend lint:
  - `cd frontend && npm run lint`

## Architecture

- `backend/app.js` wires the Express app and mounts route modules.
- `backend/src/routes/` contains API endpoints.
- `backend/src/controllers/` contains request handling logic.
- `backend/src/services/` contains external integrations, including AI/GenAI logic.
- `backend/src/models/` contains Mongoose schemas.
- `backend/src/config/` contains configuration like database connection setup.
- `frontend/src/features/` is the main feature-based area for app logic.
- `frontend/src/app.routes.jsx` is the main router setup.
- `frontend/src/features/auth/` contains the authentication flow, context, API hooks, and protected routes.

## Working conventions for AI coding agents

- Keep the backend and frontend separated; do not mix Express code into React code or vice versa.
- Follow the existing feature-based layout in the frontend and route/controller/service separation in the backend.
- Prefer reuse of the current auth patterns instead of introducing a second auth system.
- Use async/await and keep error handling consistent with the project’s Express route/controller style.
- Treat environment variables, especially API keys, as secrets; do not hardcode them in source files.
- Keep changes small and aligned with the existing project structure rather than creating new architectural layers unless needed.

## Common pitfalls

- The backend likely needs a local `.env` file for database and Gemini credentials.
- The frontend runs on Vite and expects the backend API to be available on the local dev port used by the Express server.
- Route protection is done through the existing auth context and `Protected` component; follow that pattern when adding protected pages.

## Useful references

- [backend/app.js](backend/app.js)
- [frontend/src/app.routes.jsx](frontend/src/app.routes.jsx)
- [frontend/src/features/auth/auth.context.jsx](frontend/src/features/auth/auth.context.jsx)
- [frontend/package.json](frontend/package.json)
- [backend/package.json](backend/package.json)
