# Daily Task Board

A local-first task board built with `TanStack Start`, `Drizzle ORM`, and `PostgreSQL`.

## What it does

- Creates separate task boards per day
- Stores data in PostgreSQL
- Lets you drag tasks between custom statuses
- Supports multi-category tagging
- Lets you move the same task to a different day
- Ships as an installable PWA with a basic service worker

## Development

```sh
docker compose up -d
export DATABASE_URL=postgresql://taskboard:taskboard@localhost:5432/taskboard
export APP_SHARED_PASSWORD=change-me
export SESSION_SECRET=change-this-to-a-long-random-value
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Database

Generate a new Drizzle migration after schema changes:

```sh
npm run db:generate
```

The app reads `DATABASE_URL` for database access.

Auth-related environment variables:

- `APP_SHARED_PASSWORD`: shared sign-in password required before using the app
- `SESSION_SECRET`: secret used to encrypt and sign session cookies

Set these locally in your `.env` file and in production using platform secrets (for example Railway variables).

Run schema migrations:

```sh
npm run db:migrate
```

## Verification

```sh
npm test
npm run build
```
