import { auth } from "@/auth";
import { NextResponse } from "next/server";
import { getEngineClient, EngineClientError } from "@/lib/whatsapp/engine-client";
import QRCode from "qrcode";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const engine = getEngineClient();
    const status = await engine.status();
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
  } catch (error) {
    if (error instanceof EngineClientError && !error.status) {
      return NextResponse.json({
        ready: false,
        state: "UNLAUNCHED",
        qr: null,
        phoneNumber: null,
      });
    }
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to get WhatsApp status" },
      { status: 502 }
    );
  }
}
