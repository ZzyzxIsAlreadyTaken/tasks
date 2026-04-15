# Daily Task Board

A local-first task board built with `TanStack Start`, `Drizzle ORM`, and `SQLite`.

## What it does

- Creates separate task boards per day
- Stores data locally in SQLite
- Lets you drag tasks between custom statuses
- Supports multi-category tagging
- Lets you move the same task to a different day
- Ships as an installable PWA with a basic service worker

## Development

```sh
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Database

Generate a new Drizzle migration after schema changes:

```sh
npm run db:generate
```

The local SQLite database is created in `.data/daily-task-board.sqlite`.

## Verification

```sh
npm test
npm run build
```
