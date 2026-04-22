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

Run schema migrations:

```sh
npm run db:migrate
```

## Verification

```sh
npm test
npm run build
```
