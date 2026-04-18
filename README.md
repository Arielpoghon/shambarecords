# SmartSeason Field Monitoring System

A full-stack web application for tracking crop progress across multiple fields during a growing season.

## Demo Credentials

| Role | Email | Password |
|------|-------|----------|
| Admin | admin@smartseason.com | password |
| Field Agent | agent@smartseason.com | password |

## Tech Stack

- **Backend:** Node.js + Express
- **Frontend:** React
- **Database:** PostgreSQL

## Setup Instructions

### Prerequisites
- Node.js v18+
- PostgreSQL database

### Backend Setup

```bash
cd backend
npm install
cp .env.example .env
# Edit .env with your Railway/local DATABASE_URL and JWT_SECRET
```

Create the database and run migrations:
```bash
psql -U postgres -c "CREATE DATABASE smartseason;"
psql -U postgres -d smartseason -f db.sql
```

Start the backend:
```bash
npm start
# Runs on http://localhost:5000
```

### Frontend Setup

```bash
cd frontend
npm install
npm start
# Runs on http://localhost:3000
```

For local development, the CRA dev server proxies `/api` requests to `http://localhost:5000` via `frontend/package.json`.

For production deployment on Vercel, set:
```bash
REACT_APP_API_URL=https://your-railway-app.up.railway.app/api
```

## Design Decisions

### Status Logic
Field status is computed automatically based on stage and planting date:
- **Active** — Field is progressing normally
- **At Risk** — Field has been in `planted` stage for 30+ days, or `growing` stage for 90+ days without progression
- **Completed** — Field has been harvested

This logic flags fields that may need attention from coordinators without requiring manual status updates.

### Role-Based Access
- **Admin (Coordinator):** Create fields, edit field details, assign/unassign agents, view all fields and update history
- **Field Agent:** View only assigned fields and submit stage updates with observations for those fields only

### Architecture
- JWT authentication with 7-day expiry
- RESTful API with clear separation of concerns
- Computed fields (status) derived at query time rather than stored, ensuring consistency
- Update history preserved for full audit trail
- Route-level authorization ensures agents can only access fields and updates relevant to their assignment

## API Endpoints

| Method | Endpoint | Access |
|--------|----------|--------|
| POST | /api/auth/login | Public |
| GET | /api/dashboard | Authenticated |
| GET | /api/fields | Authenticated |
| POST | /api/fields | Admin only |
| PUT | /api/fields/:id | Authenticated |
| DELETE | /api/fields/:id | Admin only |
| GET | /api/fields/:id/updates | Authenticated |
| POST | /api/fields/:id/updates | Authenticated |

## Deployment

Deploy backend to Railway with the included PostgreSQL service and set `DATABASE_URL` plus `JWT_SECRET`.
Deploy frontend to Vercel and set `REACT_APP_API_URL` to your Railway backend URL with the `/api` suffix.

Example:
```bash
REACT_APP_API_URL=https://smartseason-production.up.railway.app/api
```

## Assumptions

- Admins manage field records and assignments; field agents are the only users who submit field visit updates and observations.
- A field can remain unassigned until a coordinator assigns an agent.
- Status is computed from lifecycle stage and planting age rather than entered manually.
