import fs from "node:fs";
import path from "node:path";
import { getDb } from "@/lib/db";

/** Ensure seeded SQLite is ready for the current Vitest worker. */
export function ensureTestDb() {
  if (!process.env.DATABASE_PATH) {
    throw new Error("DATABASE_PATH must be set in tests/setup.ts");
  }
  if (process.env.DATABASE_URL) {
    delete process.env.DATABASE_URL;
  }
  fs.mkdirSync(path.dirname(process.env.DATABASE_PATH), { recursive: true });
  return getDb();
}

export function testDbPath() {
  return process.env.DATABASE_PATH!;
}
