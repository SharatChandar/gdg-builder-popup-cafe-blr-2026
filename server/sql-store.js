import { readFile } from "node:fs/promises";
import { seed, expireHolds } from "./domain.js";
import { emptyCafe } from "./live-state.js";
export async function createSqlStore({
  mode = "postgres",
  path = ".data/postgres",
  legacyPath,
  cafeId = process.env.CAFE_ID || "common-ground",
  pool: providedPool,
} = {}) {
  let initial = process.env.DEMO_MODE === "false" ? emptyCafe() : seed();
  if (legacyPath && process.env.DEMO_MODE !== "false") {
    try {
      initial = JSON.parse(await readFile(legacyPath, "utf8"));
    } catch (e) {
      if (e.code !== "ENOENT") throw e;
    }
  }
  let db,
    pool = providedPool;
  if (mode === "pglite") {
    const { PGlite } = await import("@electric-sql/pglite");
    db = new PGlite(path === ":memory:" ? undefined : path);
    await db.waitReady;
  } else if (!pool) {
    const { default: pg } = await import("pg");
    pool = new pg.Pool(
      process.env.DATABASE_URL
        ? {
            connectionString: process.env.DATABASE_URL,
            ssl:
              process.env.DB_SSL === "true"
                ? { rejectUnauthorized: true }
                : undefined,
            max: 5,
          }
        : {
            host: process.env.INSTANCE_CONNECTION_NAME
              ? `/cloudsql/${process.env.INSTANCE_CONNECTION_NAME}`
              : process.env.DB_HOST || "127.0.0.1",
            user: process.env.DB_USER,
            password: process.env.DB_PASSWORD,
            database: process.env.DB_NAME || "cafe",
            port: Number(process.env.DB_PORT || 5432),
            max: 5,
          },
    );
  }
  const query = (sql, params) =>
    db ? db.query(sql, params) : pool.query(sql, params);
  await query(
    "CREATE TABLE IF NOT EXISTS cafe_state (cafe_id TEXT PRIMARY KEY, data JSONB NOT NULL, updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW())",
  );
  await query(
    "INSERT INTO cafe_state (cafe_id,data) VALUES ($1,$2::jsonb) ON CONFLICT (cafe_id) DO NOTHING",
    [cafeId, JSON.stringify(initial)],
  );
  async function run(client, fn) {
    await client.query("BEGIN");
    try {
      const result = await client.query(
        "SELECT data FROM cafe_state WHERE cafe_id=$1 FOR UPDATE",
        [cafeId],
      );
      const state = result.rows[0].data;
      const before = JSON.stringify(state);
      expireHolds(state);
      const value = await fn(state);
      if (JSON.stringify(state) !== before)
        await client.query(
          "UPDATE cafe_state SET data=$2::jsonb,updated_at=NOW() WHERE cafe_id=$1",
          [cafeId, JSON.stringify(state)],
        );
      await client.query("COMMIT");
      return value;
    } catch (e) {
      await client.query("ROLLBACK");
      throw e;
    }
  }
  let queue = Promise.resolve();
  return {
    transact(fn) {
      if (db) {
        const task = queue.then(() => run(db, fn));
        queue = task.catch(() => {});
        return task;
      }
      return (async () => {
        const client = await pool.connect();
        try {
          return await run(client, fn);
        } finally {
          client.release();
        }
      })();
    },
    close: () => (db ? db.close() : pool.end()),
  };
}
