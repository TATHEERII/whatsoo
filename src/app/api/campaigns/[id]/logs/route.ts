import { auth } from "@/auth";
import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { ensureUser } from "@/lib/ensureUser";

export async function GET(
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

  const { searchParams } = new URL(request.url);
  const page = parseInt(searchParams.get("page") || "1", 10);
  const limit = parseInt(searchParams.get("limit") || "50", 10);
  const skip = (page - 1) * limit;

  const [logs, jobs, logTotal, jobTotal] = await Promise.all([
    prisma.campaignLog.findMany({
      where: { campaignId: params.id },
      orderBy: { sentAt: "desc" },
      select: {
        id: true,
        recipient: true,
        status: true,
        messageId: true,
        error: true,
        sentAt: true,
      },
    }),
    prisma.jobQueue.findMany({
      where: { campaignId: params.id },
      orderBy: { scheduledAt: "asc" },
      select: {
        id: true,
        recipient: true,
        recipientName: true,
        status: true,
        error: true,
        scheduledAt: true,
        processedAt: true,
        completedAt: true,
        attempts: true,
        maxAttempts: true,
      },
    }),
    prisma.campaignLog.count({ where: { campaignId: params.id } }),
    prisma.jobQueue.count({ where: { campaignId: params.id } }),
  ]);

  type UnifiedEntry = {
    id: string;
    source: "log" | "job";
    recipient: string;
    recipientName: string | null;
    status: string;
    messageId: string | null;
    error: string | null;
    timestamp: string;
    attempts?: number;
    maxAttempts?: number;
  };

  const unified: UnifiedEntry[] = [
    ...logs.map((l) => ({
      id: l.id,
      source: "log" as const,
      recipient: l.recipient,
      recipientName: null,
      status: l.status,
      messageId: l.messageId,
      error: l.error,
      timestamp: new Date(l.sentAt).toISOString(),
    })),
    ...jobs.map((j) => ({
      id: j.id,
      source: "job" as const,
      recipient: j.recipient ?? "(unknown)",
      recipientName: j.recipientName ?? null,
      status: j.status,
      messageId: null,
      error: j.error,
      timestamp:
        (j.completedAt ?? j.processedAt ?? j.scheduledAt).toISOString(),
      attempts: j.attempts,
      maxAttempts: j.maxAttempts,
    })),
  ];

  unified.sort((a, b) => {
    if (a.source === b.source) {
      return a.timestamp < b.timestamp ? 1 : -1;
    }
    return a.source === "job" ? -1 : 1;
  });

  const total = logTotal + jobTotal;
  const paged = unified.slice(skip, skip + limit);

  return NextResponse.json({
    logs: paged,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  });
}