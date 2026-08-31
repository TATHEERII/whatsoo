import { auth } from "@/auth";
import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { ensureUser } from "@/lib/ensureUser";
import { getSqliteQueueService } from "@/lib/sqliteQueue";

const VALID_TRANSITIONS: Record<string, string> = {
  start: "running",
  pause: "paused",
  resume: "running",
  stop: "stopped",
};

const ALLOWED_CURRENT_STATUSES: Record<string, string[]> = {
  start: ["draft", "stopped"],
  pause: ["running"],
  resume: ["paused"],
  stop: ["running", "paused"],
};

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

  const body = await request.json();
  const { action } = body;

  if (!action || !VALID_TRANSITIONS[action]) {
    return NextResponse.json(
      { error: "Invalid action. Must be one of: start, pause, resume, stop" },
      { status: 400 }
    );
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

  const allowedCurrent = ALLOWED_CURRENT_STATUSES[action];
  if (!allowedCurrent.includes(campaign.status)) {
    return NextResponse.json(
      {
        error: `Cannot ${action} campaign from status '${campaign.status}'`,
      },
      { status: 400 }
    );
  }

  const sqliteQueue = getSqliteQueueService();

  if (action === "start") {
    sqliteQueue.startScheduler();

    const startBody = await request.json().catch(() => ({}));
    await sqliteQueue.enqueueCampaign({
      campaignId: params.id,
      delayType: startBody.delayType,
      delayValue: startBody.delayValue ? Number(startBody.delayValue) : undefined,
      maxAttempts: startBody.maxAttempts ? Number(startBody.maxAttempts) : undefined,
    });
  }

  const updatedCampaign = await prisma.campaign.update({
    where: { id: params.id },
    data: { status: VALID_TRANSITIONS[action] },
  });

  return NextResponse.json({
    id: updatedCampaign.id,
    name: updatedCampaign.name,
    status: updatedCampaign.status,
    updatedAt: updatedCampaign.updatedAt,
  });
}
