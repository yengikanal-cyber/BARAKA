# Baraka

B2B trade management web app (CRM) for businesses in Uzbekistan. Connects sellers/manufacturers with shop owners/buyers to manage deliveries, orders, returns, and debts.

## Stack

- **Frontend:** React + Vite + TypeScript + Tailwind CSS
- **Backend:** Node.js + Express + TypeScript
- **Database:** SQLite for dev (designed for easy move to PostgreSQL)
- **Auth:** Email + password (bcrypt), JWT in httpOnly cookie
- **i18n:** uz (default), ru, en
- **Styling:** macOS / Liquid Glass aesthetic

## Quick start

```bash
# 1. Install everything (root + server + client)
npm run install:all

# 2. Copy environment file
copy server\.env.example server\.env       # Windows
# cp server/.env.example server/.env       # macOS / Linux

# 3. Run dev (server on :4000, client on :5173)
npm run dev
```

Open <http://localhost:5173> in your browser.

## Folder structure

```
baraka/
  server/             Express API
    src/
      index.ts        Server entrypoint
      db.ts           SQLite connection + schema
      auth.ts         JWT + password helpers
      routes/         API route handlers
    uploads/          User-uploaded images (avatars, products, etc.)
    data/             SQLite database file
  client/             React (Vite) frontend
    src/
      pages/
      components/
      contexts/       Theme + auth contexts
      i18n/           Translation files (uz, ru, en)
      api.ts          API client
```

## Scripts

| Command | What it does |
|---|---|
| `npm run install:all` | Install root + server + client dependencies |
| `npm run dev` | Run both server and client in dev mode |
| `npm run dev:server` | Run only the server |
| `npm run dev:client` | Run only the client |
| `npm run build` | Build server and client for production |
| `npm start` | Start the production server |
