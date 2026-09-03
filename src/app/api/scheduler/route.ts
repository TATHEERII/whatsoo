import { auth } from "@/auth";
import { NextResponse } from "next/server";
import { getSqliteQueueService } from "@/lib/sqliteQueue";

export async function POST() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const queue = getSqliteQueueService();
  // In serverless environments, the scheduler runs via cron, not setInterval.
  // This endpoint triggers an immediate processing cycle.
  await queue.triggerProcessing();

  return NextResponse.json({ status: "completed" });
}

export async function DELETE() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const queue = getSqliteQueueService();
  queue.stopScheduler();

  return NextResponse.json({ status: "stopped" });
}
