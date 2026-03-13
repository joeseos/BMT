import Database from 'better-sqlite3'
import { drizzle } from 'drizzle-orm/better-sqlite3'
import { migrate } from 'drizzle-orm/better-sqlite3/migrator'
import { mkdirSync } from 'fs'

// Ensure data directory exists
mkdirSync('./data', { recursive: true })

const sqlite = new Database('./data/pricing.db')
sqlite.pragma('journal_mode = WAL')
sqlite.pragma('foreign_keys = ON')

const db = drizzle(sqlite)

console.log('Running migrations...')
migrate(db, { migrationsFolder: './src/server/db/migrations' })
console.log('Migrations complete.')

sqlite.close()
