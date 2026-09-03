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
    include: {
      contactList: {
        select: {
          id: true,
          name: true,
          _count: { select: { contacts: true } },
        },
      },
    },
  });

  if (!campaign) {
    return NextResponse.json({ error: "Campaign not found" }, { status: 404 });
  }

  const statusCounts = await prisma.campaignLog.groupBy({
    by: ["status"],
    where: { campaignId: params.id },
    _count: { _all: true },
  });

  const countMap = new Map(statusCounts.map((s) => [s.status, s._count._all]));
  const totalLogs = statusCounts.reduce(
    (sum, s) => sum + s._count._all,
    0
  );
  const sentLogs = countMap.get("sent") ?? 0;
  const failedLogs = countMap.get("failed") ?? 0;
  const totalContacts = campaign.contactList?._count.contacts ?? 0;

  const successRate =
    totalLogs > 0 ? ((sentLogs / totalLogs) * 100).toFixed(1) : "0.0";

  return NextResponse.json({
    id: campaign.id,
    name: campaign.name,
    description: campaign.description,
    status: campaign.status,
    templateName: campaign.templateName,
    contactListName: campaign.contactList?.name ?? null,
    scheduledAt: campaign.scheduledAt,
    createdAt: campaign.createdAt,
    updatedAt: campaign.updatedAt,
    stats: {
      totalContacts,
      sent: sentLogs,
      failed: failedLogs,
      successRate: `${successRate}%`,
    },
  });
}
