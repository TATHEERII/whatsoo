import { auth } from "@/auth";
import { NextResponse } from "next/server";
import { getWhatsAppEngine } from "@/lib/whatsapp/engine";

export const dynamic = "force-dynamic";

export async function POST() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const engine = getWhatsAppEngine();
    // Clear session on explicit disconnect so next connect shows QR code
    await engine.disconnect(true);
    return NextResponse.json({ success: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to disconnect";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
