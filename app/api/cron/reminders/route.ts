import { NextResponse } from "next/server";
import { runDailyReminders } from "@/lib/cron/reminders";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  const auth = request.headers.get("authorization");
  if (!secret || auth !== `Bearer ${secret}`) {
    return NextResponse.json({ ok: false, error: "Unauthorized." }, { status: 401 });
  }

  const result = await runDailyReminders();
  return NextResponse.json(result);
}
