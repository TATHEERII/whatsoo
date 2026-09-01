import { auth } from "@/auth";
import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { ensureUser } from "@/lib/ensureUser";
import { parse } from "csv-parse/sync";

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

  const contactList = await prisma.contactList.findFirst({
    where: {
      id: params.id,
      userId: dbUserId,
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
    const skipped: { phone: string; reason: string }[] = [];

    const lowerRecord = (rec: Record<string, string>): Record<string, string> => {
      const out: Record<string, string> = {};
      for (const k in rec) {
        out[k.toLowerCase().replace(/\s+/g, "_")] = rec[k];
      }
      return out;
    };

    for (const record of records) {
      const rec = lowerRecord(record);

      const name = rec.name || rec.full_name || rec.fullname || rec.contact_name || rec.contactname || rec.lead_name || rec.customer_name || "";
      const phoneNumber = rec.phone || rec.phone_number || rec.phonenumber || rec.mobile || rec.whatsapp || rec.contact || rec.number || "";
      const email = rec.email || rec.mail || rec.email_address || rec.emailaddress || "";

      const trimmedPhone = phoneNumber?.trim() || "";
      const trimmedName = name?.trim() || "";
      const trimmedEmail = email?.trim() || "";

      if (!trimmedPhone) {
        skipped.push({ phone: trimmedName || "unknown", reason: "Missing phone number" });
        continue;
      }

      const finalName = trimmedName || trimmedPhone;

      try {
        const contact = await prisma.contact.create({
          data: {
            name: finalName,
            phoneNumber: trimmedPhone || null,
            email: trimmedEmail || null,
            userId: dbUserId,
            contactListId: contactList.id,
          },
        });

        createdContacts.push(contact);
      } catch (e) {
        const err = e as { code?: string; meta?: { target?: string[] } };
        if (err?.code === "P2002") {
          const target = err?.meta?.target as string[] | undefined;
          if (target?.includes("email")) {
            skipped.push({ phone: trimmedPhone, reason: `Duplicate email: ${trimmedEmail}` });
          } else {
            skipped.push({ phone: trimmedPhone, reason: "Phone number already exists" });
          }
        } else {
          throw e;
        }
      }
    }

    return NextResponse.json({
      success: true,
      imported: createdContacts.length,
      skipped,
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
