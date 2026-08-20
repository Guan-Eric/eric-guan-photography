import { NextResponse } from "next/server";
import { getDb, qGet, schema } from "@/lib/db";

export const runtime = "nodejs";

export async function GET() {
  try {
    const db = getDb();
    await qGet(
      db.select({ id: schema.tenants.id }).from(schema.tenants).limit(1),
    );
    return NextResponse.json({
      ok: true,
      status: "healthy",
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        status: "unhealthy",
        error: error instanceof Error ? error.message : "Database unavailable.",
      },
      { status: 503 },
    );
  }
}
