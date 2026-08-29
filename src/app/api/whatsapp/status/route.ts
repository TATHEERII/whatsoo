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
    });
  } catch {
    return NextResponse.json({ ready: false, state: "UNLAUNCHED", qr: null });
  }
}
