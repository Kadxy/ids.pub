import { Database } from 'bun:sqlite'
import { readdirSync, readFileSync } from 'node:fs'

/**
 * Just enough of D1 for tests, on top of bun:sqlite, with foreign keys on like D1.
 * The schema comes from running every migration file in order.
 */
export function testD1(): D1Database {
  const sqlite = new Database(':memory:')
  sqlite.exec('PRAGMA foreign_keys = ON')
  const migrations = new URL('../migrations/', import.meta.url)
  for (const file of readdirSync(migrations)
    .filter((name) => name.endsWith('.sql'))
    .sort()) {
    sqlite.exec(readFileSync(new URL(file, migrations), 'utf8'))
  }

  class Statement {
    constructor(
      readonly sql: string,
      readonly params: unknown[] = [],
    ) {}
    bind(...params: unknown[]) {
      return new Statement(this.sql, params)
    }
    async first<T>(column?: string): Promise<T | null> {
      const row = sqlite.query(this.sql).get(...(this.params as never[])) as Record<
        string,
        unknown
      > | null
      if (!row) return null
      return (column ? row[column] : row) as T
    }
    async all<T>() {
      return { results: this.allSync() as T[], success: true, meta: {} }
    }
    async run() {
      return this.runSync()
    }
    allSync() {
      return sqlite.query(this.sql).all(...(this.params as never[]))
    }
    runSync() {
      const isRead = /^\s*select/i.test(this.sql)
      if (isRead) return { results: this.allSync(), success: true, meta: { changes: 0 } }
      const result = sqlite.query(this.sql).run(...(this.params as never[]))
      return { results: [], success: true, meta: { changes: result.changes } }
    }
  }

  return {
    prepare: (sql: string) => new Statement(sql),
    batch: async (statements: Statement[]) =>
      sqlite.transaction(() => statements.map((statement) => statement.runSync()))(),
    exec: async (sql: string) => {
      sqlite.exec(sql)
      return { count: 0, duration: 0 }
    },
  } as unknown as D1Database
}
