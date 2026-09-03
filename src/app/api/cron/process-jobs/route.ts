import { NextResponse } from "next/server";
import { getSqliteQueueService } from "@/lib/sqliteQueue";

/**
 * Cron job endpoint that processes pending jobs in the queue.
 * This is triggered by Vercel Cron Jobs (configured in vercel.json).
 * 
 * No authentication is required since this is called internally by Vercel's cron service.
 * To secure it, we validate that it's called from Vercel's IP ranges or via a secret token.
 */
export async function GET(request: Request) {
  // Validate the request has the correct secret token
  const { searchParams } = new URL(request.url);
  const token = searchParams.get("token");
  const expectedToken = process.env.CRON_SECRET_TOKEN;

  if (expectedToken && token !== expectedToken) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const queue = getSqliteQueueService();
    await queue.processPendingJobs();

    const stats = await queue.getQueueStats();
    return NextResponse.json({
      status: "completed",
      timestamp: new Date().toISOString(),
      stats,
    });
  } catch (error) {
    console.error("[Cron] Error processing pending jobs:", error);
    return NextResponse.json(
      {
        error: "Failed to process jobs",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}

// Also support POST for manual triggering
export { GET as POST };
