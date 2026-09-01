import { auth } from "@/auth";
import { NextResponse } from "next/server";
import { getEngineClient } from "@/lib/whatsapp/engine-client";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  let clearSession = true;
  try {
    const body = await req.json().catch(() => ({}));
    clearSession = body?.clearSession !== false;
  } catch {
    /* default true */
  }
  try {
    const engine = getEngineClient();
    const result = await engine.disconnect(clearSession);
    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to disconnect";
    const status = (error as { status?: number }).status ?? 502;
    const finalStatus = status >= 400 && status < 600 && status !== 502 ? status : 502;
    return NextResponse.json(
      { success: false, error: message },
      { status: finalStatus }
    );
  }
}
