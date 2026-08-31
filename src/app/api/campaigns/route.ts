import { auth } from "@/auth";
import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { ensureUser } from "@/lib/ensureUser";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const dbUserId = await ensureUser(session?.user);
  if (!dbUserId) {
    return NextResponse.json({ error: "Failed to sync user" }, { status: 500 });
  }

  const campaigns = await prisma.campaign.findMany({
    where: { userId: dbUserId },
    include: {
      contactList: {
        select: { name: true },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json(
    campaigns.map((campaign) => ({
      id: campaign.id,
      name: campaign.name,
      description: campaign.description,
      status: campaign.status,
      templateName: campaign.templateName,
      contactListName: campaign.contactList?.name ?? null,
      scheduledAt: campaign.scheduledAt,
      createdAt: campaign.createdAt,
      updatedAt: campaign.updatedAt,
    }))
  );
}

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const {
    name,
    description,
    message,
    templateId,
    templateName,
    contactListId,
    scheduledAt,
    delayType,
    delayValue,
    maxAttempts,
  } = body;

  if (!name || typeof name !== "string" || name.trim().length === 0) {
    return NextResponse.json({ error: "Name is required" }, { status: 400 });
  }

  const dbUserId = await ensureUser(session?.user);
  if (!dbUserId) {
    return NextResponse.json({ error: "Failed to sync user" }, { status: 500 });
  }

  if (contactListId) {
    const contactList = await prisma.contactList.findFirst({
      where: { id: contactListId, userId: dbUserId },
    });
    if (!contactList) {
      return NextResponse.json({ error: "Contact list not found" }, { status: 404 });
    }
  }

  const campaign = await prisma.campaign.create({
    data: {
      name: name.trim(),
      description: description?.trim() || null,
      message: message?.trim() || null,
      templateId: templateId || null,
      templateName: templateName?.trim() || null,
      contactListId: contactListId || null,
      scheduledAt: scheduledAt ? new Date(scheduledAt) : null,
      delayType: delayType ?? "fixed",
      delayValue: delayValue ? Number(delayValue) : 5000,
      maxAttempts: maxAttempts ? Number(maxAttempts) : 3,
      userId: dbUserId,
    },
    include: {
      contactList: {
        select: { name: true },
      },
    },
  });

  return NextResponse.json(
    {
      id: campaign.id,
      name: campaign.name,
      description: campaign.description,
      status: campaign.status,
      templateName: campaign.templateName,
      contactListName: campaign.contactList?.name ?? null,
      scheduledAt: campaign.scheduledAt,
      createdAt: campaign.createdAt,
      updatedAt: campaign.updatedAt,
    },
    { status: 201 }
  );
}
