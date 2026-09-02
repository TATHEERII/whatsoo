import { auth } from "@/auth";
import { NextResponse } from "next/server";
import { getEngineClient } from "@/lib/whatsapp/engine-client";

export const dynamic = "force-dynamic";

export async function POST() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const engine = getEngineClient();
    const result = await engine.reconnect();

    if (!result.success) {
      return NextResponse.json(
        { success: false, error: "Failed to reconnect WhatsApp" },
        { status: 502 }
      );
    }

    return NextResponse.json({
      success: true,
      message: "Reconnecting WhatsApp...",
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to reconnect WhatsApp";
    const status = (error as { status?: number }).status ?? 502;
    const finalStatus = status >= 400 && status < 600 && status !== 502 ? status : 502;
    return NextResponse.json(
      { success: false, error: message },
      { status: finalStatus }
    );
  }
}
