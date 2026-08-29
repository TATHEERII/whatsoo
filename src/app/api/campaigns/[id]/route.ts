import { auth } from "@/auth";
import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const campaign = await prisma.campaign.findFirst({
    where: {
      id: params.id,
      userId: session.user.id,
    },
    include: {
      contactList: {
        select: { id: true, name: true },
      },
    },
  });

  if (!campaign) {
    return NextResponse.json({ error: "Campaign not found" }, { status: 404 });
  }

  const [totalLogs, sentLogs, failedLogs] = await Promise.all([
    prisma.campaignLog.count({
      where: { campaignId: params.id },
    }),
    prisma.campaignLog.count({
      where: { campaignId: params.id, status: "sent" },
    }),
    prisma.campaignLog.count({
      where: { campaignId: params.id, status: "failed" },
    }),
  ]);

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
      totalContacts: totalLogs,
      sent: sentLogs,
      failed: failedLogs,
      successRate: `${successRate}%`,
    },
  });
}