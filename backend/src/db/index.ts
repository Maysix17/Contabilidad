import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';

import * as schema from '@/db/schema';

const connectionString =
  process.env.DATABASE_URL ?? 'postgres://contabilidad:contabilidad@localhost:5432/contabilidad';

const globalForDb = globalThis as unknown as { sqlClient?: postgres.Sql };

export const sql =
  globalForDb.sqlClient ??
  postgres(connectionString, {
    max: process.env.NODE_ENV === 'production' ? 10 : 1,
    onnotice: () => {},
  });

if (process.env.NODE_ENV !== 'production') {
  globalForDb.sqlClient = sql;
}

export const db = drizzle(sql, { schema });
