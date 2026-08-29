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
  });

  if (!campaign) {
    return NextResponse.json({ error: "Campaign not found" }, { status: 404 });
  }

  const { searchParams } = new URL(request.url);
  const page = parseInt(searchParams.get("page") || "1", 10);
  const limit = parseInt(searchParams.get("limit") || "50", 10);
  const skip = (page - 1) * limit;

  const [logs, total] = await Promise.all([
    prisma.campaignLog.findMany({
      where: { campaignId: params.id },
      orderBy: { sentAt: "desc" },
      skip,
      take: limit,
      select: {
        id: true,
        recipient: true,
        status: true,
        messageId: true,
        error: true,
        sentAt: true,
      },
    }),
    prisma.campaignLog.count({
      where: { campaignId: params.id },
    }),
  ]);

  return NextResponse.json({
    logs,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  });
}