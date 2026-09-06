import path from 'path';
import fs from 'fs';
import { Pool } from 'pg';
import initSqlJs, { Database as SqlJsDatabase } from 'sql.js';

export interface QueryResult<T = any> {
  rows: T[];
  rowCount: number;
}

export interface DbClient {
  query<T = any>(text: string, params?: any[]): Promise<QueryResult<T>>;
}

const DATABASE_URL = process.env.DATABASE_URL;
let client: DbClient;

if (DATABASE_URL && DATABASE_URL.startsWith('postgres')) {
  const pool = new Pool({ connectionString: DATABASE_URL });
  client = {
    async query<T = any>(text: string, params?: any[]): Promise<QueryResult<T>> {
      const res = await pool.query(text, params);
      return {
        rows: res.rows as T[],
        rowCount: res.rowCount ?? res.rows.length,
      };
    },
  };
} else {
  // Use persistent SQLite for local dev
  const storageDir = path.resolve(__dirname, '../../../storage');
  if (!fs.existsSync(storageDir)) {
    fs.mkdirSync(storageDir, { recursive: true });
  }
  const dbPath = path.join(storageDir, 'neotheatre.db');

  let dbInstance: SqlJsDatabase | null = null;
  let lastMtime = 0;

  async function getDb(): Promise<SqlJsDatabase> {
    const currentMtime = fs.existsSync(dbPath) ? fs.statSync(dbPath).mtimeMs : 0;
    if (dbInstance && currentMtime <= lastMtime) return dbInstance;

    const SQL = await initSqlJs();
    if (fs.existsSync(dbPath)) {
      const fileBuffer = fs.readFileSync(dbPath);
      dbInstance = new SQL.Database(fileBuffer);
      lastMtime = fs.statSync(dbPath).mtimeMs;
    } else {
      dbInstance = new SQL.Database();
      lastMtime = 0;
    }

    // Run schema if tables don't exist
    const schemaPath = path.resolve(__dirname, '../../../database/schema.sql');
    if (fs.existsSync(schemaPath)) {
      let schemaSql = fs.readFileSync(schemaPath, 'utf8');
      schemaSql = schemaSql
        .replace(/UUID PRIMARY KEY DEFAULT gen_random_uuid\(\)/g, 'TEXT PRIMARY KEY')
        .replace(/TIMESTAMP DEFAULT CURRENT_TIMESTAMP/g, "DATETIME DEFAULT (datetime('now'))")
        .replace(/TIMESTAMP DEFAULT NOW\(\)/g, "DATETIME DEFAULT (datetime('now'))")
        .replace(/DECIMAL\(6,\s*2\)/g, 'REAL')
        .replace(/TEXT\[\]/g, 'TEXT')
        .replace(/INET/g, 'TEXT');
      try {
        dbInstance.run(schemaSql);
        saveDb();
      } catch (err) {
        console.warn('SQLite schema notice:', err);
      }
    }
    return dbInstance;
  }

  function saveDb() {
    if (!dbInstance) return;
    try {
      const data = dbInstance.export();
      const buffer = Buffer.from(data);
      fs.writeFileSync(dbPath, buffer);
      lastMtime = fs.statSync(dbPath).mtimeMs;
    } catch (e) {
      console.error('Failed to save SQLite DB:', e);
    }
  }

  client = {
    async query<T = any>(text: string, params: any[] = []): Promise<QueryResult<T>> {
      const db = await getDb();

      // Convert Postgres parameterized query $1, $2 to SQLite ?
      let sqliteText = text.replace(/\$(\d+)/g, '?');
      sqliteText = sqliteText.replace(/NOW\(\)/gi, "datetime('now')");

      const isSelect = /^\s*SELECT/i.test(sqliteText);
      const isInsert = /^\s*INSERT/i.test(sqliteText);

      try {
        if (isSelect) {
          const stmt = db.prepare(sqliteText);
          stmt.bind(params);
          const rows: any[] = [];
          while (stmt.step()) {
            rows.push(stmt.getAsObject());
          }
          stmt.free();
          return {
            rows: rows as T[],
            rowCount: rows.length,
          };
        } else {
          db.run(sqliteText, params);
          saveDb();

          // If insert returning, fetch the inserted record
          let rows: any[] = [];
          if (/RETURNING\s+\*/i.test(sqliteText)) {
            // Find id from params if available
            const idParam = params.find(
              (p) => typeof p === 'string' && /^[0-9a-f-]{36}$/i.test(p)
            );
            if (idParam) {
              rows = [{ id: idParam }];
            }
          }

          return {
            rows: rows as T[],
            rowCount: 1,
          };
        }
      } catch (err) {
        console.error('Database query error:', err, 'SQL:', sqliteText, 'Params:', params);
        throw err;
      }
    },
  };
}

export const db = client;
