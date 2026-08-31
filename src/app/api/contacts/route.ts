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

  const contacts = await prisma.contact.findMany({
    where: { userId: dbUserId },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json(contacts);
}

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const { name, phoneNumber, email, contactListId } = body;

  if (!name) {
    return NextResponse.json({ error: "Name is required" }, { status: 400 });
  }

  const dbUserId = await ensureUser(session?.user);
  if (!dbUserId) {
    return NextResponse.json({ error: "Failed to sync user" }, { status: 500 });
  }

  const contact = await prisma.contact.create({
    data: {
      name,
      phoneNumber,
      email,
      userId: dbUserId,
      contactListId,
    },
  });

  return NextResponse.json(contact, { status: 201 });
}
