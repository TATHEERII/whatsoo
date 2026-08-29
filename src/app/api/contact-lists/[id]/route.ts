import { auth } from "@/auth";
import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export async function DELETE(
  _request: Request,
  { params }: { params: { id: string } }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const contactList = await prisma.contactList.findFirst({
    where: {
      id: params.id,
      userId: session.user.id,
    },
  });

  if (!contactList) {
    return NextResponse.json({ error: "Contact list not found" }, { status: 404 });
  }

  await prisma.contactList.delete({
    where: { id: params.id },
  });

  return NextResponse.json({ success: true });
}
