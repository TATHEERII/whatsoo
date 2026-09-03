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

const body = await request.json().catch(() => ({}));
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

    let enqueuedCount = 0;
    try {
      enqueuedCount = await sqliteQueue.enqueueCampaign({
        campaignId: params.id,
        delayType: body.delayType,
        delayValue: body.delayValue ? Number(body.delayValue) : undefined,
        maxAttempts: body.maxAttempts ? Number(body.maxAttempts) : undefined,
      });
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Failed to enqueue campaign";
      return NextResponse.json(
        { error: message },
        { status: 400 }
      );
    }

    if (enqueuedCount === 0) {
      return NextResponse.json(
        {
          error:
            "No contacts to send to. The selected contact list is empty.",
          id: campaign.id,
          name: campaign.name,
          status: campaign.status,
        },
        { status: 400 }
      );
    }

    void sqliteQueue.triggerProcessing().catch((err) =>
      console.error("[SQLiteQueue] Error processing jobs after enqueue:", err)
    );
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
