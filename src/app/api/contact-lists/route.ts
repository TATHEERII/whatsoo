import { auth } from "@/auth";
import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const contactLists = await prisma.contactList.findMany({
    where: { userId: session.user.id },
    include: {
      _count: {
        select: { contacts: true },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json(
    contactLists.map((list) => ({
      id: list.id,
      name: list.name,
      description: list.description,
      contactCount: list._count.contacts,
      createdAt: list.createdAt,
      updatedAt: list.updatedAt,
    }))
  );
}

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const { name, description } = body;

  if (!name || typeof name !== "string" || name.trim().length === 0) {
    return NextResponse.json({ error: "Name is required" }, { status: 400 });
  }

  const contactList = await prisma.contactList.create({
    data: {
      name: name.trim(),
      description: description?.trim() || null,
      userId: session.user.id,
    },
    include: {
      _count: {
        select: { contacts: true },
      },
    },
  });

  return NextResponse.json(
    {
      id: contactList.id,
      name: contactList.name,
      description: contactList.description,
      contactCount: contactList._count.contacts,
      createdAt: contactList.createdAt,
      updatedAt: contactList.updatedAt,
    },
    { status: 201 }
  );
}
