import { migrate } from 'drizzle-orm/better-sqlite3/migrator'
import { drizzle } from 'drizzle-orm/better-sqlite3'
import Database from 'better-sqlite3'

export function runMigrations(dbPath: string) {
  const sqlite = new Database(dbPath)
  const db = drizzle(sqlite)
  migrate(db, { migrationsFolder: './src/server/db/migrations' })
  sqlite.close()
}
