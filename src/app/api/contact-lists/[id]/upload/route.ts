import { auth } from "@/auth";
import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { parse } from "csv-parse/sync";

export async function POST(
  request: Request,
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

  try {
    const formData = await request.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json({ error: "No file uploaded" }, { status: 400 });
    }

    const text = await file.text();
    const records = parse(text, {
      columns: true,
      skip_empty_lines: true,
      trim: true,
    }) as Record<string, string>[];

    if (records.length === 0) {
      return NextResponse.json({ error: "CSV file is empty" }, { status: 400 });
    }

    const createdContacts = [];

    for (const record of records) {
      const name = record.name || record.Name || record.NAME;
      const phoneNumber = record.phoneNumber || record.phone || record.Phone || record.PhoneNumber;
      const email = record.email || record.Email || record.EMAIL;

      if (!name) continue;

      const contact = await prisma.contact.create({
        data: {
          name: name.trim(),
          phoneNumber: phoneNumber?.trim() || null,
          email: email?.trim() || null,
          userId: session.user.id,
          contactListId: contactList.id,
        },
      });

      createdContacts.push(contact);
    }

    return NextResponse.json({
      success: true,
      imported: createdContacts.length,
      contacts: createdContacts,
    });
  } catch (error) {
    console.error("CSV upload error:", error);
    return NextResponse.json(
      { error: "Failed to process CSV file" },
      { status: 500 }
    );
  }
}
