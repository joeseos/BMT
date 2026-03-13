import { drizzle } from 'drizzle-orm/better-sqlite3'
import Database from 'better-sqlite3'
import * as schema from './schema'
import { runMigrations } from './migrate'

const dbPath = process.env.DATABASE_URL?.replace('file:', '') || './data/pricing.db'

runMigrations(dbPath)

const sqlite = new Database(dbPath)
sqlite.pragma('journal_mode = WAL')
sqlite.pragma('foreign_keys = ON')

export const db = drizzle(sqlite, { schema })
