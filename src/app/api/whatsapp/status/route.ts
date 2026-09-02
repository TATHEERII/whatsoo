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
      initializing: status.initializing ?? false,
      qr: qrImage,
      phoneNumber: status.phoneNumber,
      error: status.error ?? null,
    });
  } catch (error) {
    if (error instanceof EngineClientError && !error.status) {
      const reason = error instanceof Error ? error.message : "engine unreachable";
      return NextResponse.json({
        ready: false,
        state: "UNLAUNCHED",
        initializing: false,
        qr: null,
        phoneNumber: null,
        error: `WhatsApp engine unreachable: ${reason}`,
      });
    }
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to get WhatsApp status" },
      { status: 502 }
    );
  }
}
