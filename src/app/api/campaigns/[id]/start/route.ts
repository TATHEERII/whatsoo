import { auth } from "@/auth";
import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { ensureUser } from "@/lib/ensureUser";
import { getSqliteQueueService } from "@/lib/sqliteQueue";

export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const dbUserId = await ensureUser(session?.user);
  if (!dbUserId) {
    return NextResponse.json({ error: "Failed to sync user" }, { status: 500 });
  }

  const campaign = await prisma.campaign.findFirst({
    where: {
      id: params.id,
      userId: dbUserId,
    },
  });

  if (!campaign) {
    return NextResponse.json({ error: "Campaign not found" }, { status: 404 });
  }

  if (campaign.status !== "draft" && campaign.status !== "stopped") {
    return NextResponse.json(
      { error: `Cannot start campaign from status '${campaign.status}'` },
      { status: 400 }
    );
  }

  const body = await request.json().catch(() => ({}));
  const { scheduledAt, delayType, delayValue, maxAttempts } = body;

  const sqliteQueue = getSqliteQueueService();
  sqliteQueue.startScheduler();

  await sqliteQueue.enqueueCampaign({
    campaignId: params.id,
    delayType,
    delayValue: delayValue ? Number(delayValue) : undefined,
    maxAttempts: maxAttempts ? Number(maxAttempts) : undefined,
  });

  // Trigger an immediate processing cycle in serverless environments
  // (cron jobs will also trigger periodically as a fallback)
  void sqliteQueue.triggerProcessing().catch((err) =>
    console.error("[SQLiteQueue] Error processing jobs after enqueue:", err)
  );

  const updatedCampaign = await prisma.campaign.update({
    where: { id: params.id },
    data: scheduledAt ? { scheduledAt: new Date(scheduledAt) } : {},
  });

  return NextResponse.json({
    id: updatedCampaign.id,
    name: updatedCampaign.name,
    status: updatedCampaign.status,
    scheduledAt: updatedCampaign.scheduledAt,
    updatedAt: updatedCampaign.updatedAt,
  });
}
