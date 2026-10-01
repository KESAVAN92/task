# Ledgerline Accountant Request Tracker

A small MERN prototype for creating client work requests, tracking status, sorting by due date, and generating overdue reminders. All included records and client names are fictional sample data.

## Run locally

Requirements: Node.js 18+ and npm. MongoDB is optional.

```powershell
npm install
npm install --prefix server
npm install --prefix client
npm run dev
```

Open the Vite URL printed by the client, usually `http://localhost:5173`. The API runs on `http://localhost:5000`.

Without `MONGO_URI`, the API seeds fictional in-memory demo requests; changes disappear when the server restarts. To persist requests, copy `server/.env.example` to `server/.env`, set `MONGO_URI` to a MongoDB connection string, then restart the server. MongoDB must be running and reachable.

## What works

- Create a request with a title, client name, assignee, due date, and status.
- View requests sorted by due date and filter by status or overdue state.
- Change a request's status from the work queue.
- Automatically check overdue open requests at startup and hourly; generated reminders are printed in the API terminal, with a 24-hour repeat interval per request.
- Generate reminders on demand with the dashboard button or `POST /api/reminders/check`.
- List overdue requests through `GET /api/requests/overdue` or run `npm run overdue --prefix server` while the API is running.

## API

- `GET /api/requests` returns requests sorted by due date. Add `?status=Open` to filter.
- `GET /api/requests/overdue` returns incomplete overdue requests in due-date order.
- `POST /api/requests` creates a request.
- `PATCH /api/requests/:id` updates its status.
- `POST /api/reminders/check` generates and logs reminders for overdue requests.

## With more time

Add authentication and role-based access, deliver reminders by email, persist reminder history, and add automated API tests and pagination. The current prototype is intended for local evaluation, not production use.