import { auth } from "@/auth";
import { NextResponse } from "next/server";
import { getWhatsAppEngine } from "@/lib/whatsapp/engine";
import QRCode from "qrcode";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const engine = getWhatsAppEngine();

    const status = await engine.getStatus();

    // Debug logging - remove after fixing
    if (status.ready) {
      console.log("[WhatsApp Status] Client info:", engine.debugClientInfo());
    }

    let qrImage: string | null = null;
    if (status.qr) {
      try {
        qrImage = await QRCode.toDataURL(status.qr, { width: 256, margin: 1 });
      } catch {
        qrImage = null;
      }
    }

    return NextResponse.json({
      ready: status.ready,
      state: status.state,
      qr: qrImage,
      phoneNumber: status.phoneNumber,
    });
  } catch {
    return NextResponse.json({ ready: false, state: "UNLAUNCHED", qr: null, phoneNumber: null });
  }
}
