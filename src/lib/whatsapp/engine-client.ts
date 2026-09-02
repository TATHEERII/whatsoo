export interface EngineStatus {
  ready: boolean;
  state: string;
  qr: string | null;
  phoneNumber: string | null;
  error: string | null;
}

export interface SendPayload {
  to: string;
  text?: string;
  filePath?: string;
  mediaType?: "image" | "video";
}

export class EngineClientError extends Error {
  constructor(
    message: string,
    public readonly status?: number
  ) {
    super(message);
    this.name = "EngineClientError";
  }
}

export class WhatsAppEngineClient {
  private readonly baseUrl: string;
  private readonly token: string;

  constructor(opts?: { baseUrl?: string; token?: string }) {
    this.baseUrl =
      opts?.baseUrl ?? process.env.WHATSAPP_ENGINE_URL ?? "http://localhost:3001";
    this.token = opts?.token ?? process.env.WHATSAPP_ENGINE_TOKEN ?? "";
  }

  async health(): Promise<{ ok: boolean; uptime: number }> {
    return this.request<{ ok: boolean; uptime: number }>("/health", "GET");
  }

  /**
   * Status checks happen frequently (polling). Use a short timeout so that
   * an unreachable engine fails fast instead of blocking the request for
   * the full default 10s. The client-side polling loop provides backoff.
   */
  async status(): Promise<EngineStatus> {
    return this.request<EngineStatus>("/status", "GET", undefined, 1500);
  }

  async connect(): Promise<{ success: boolean; message?: string }> {
    return this.request<{ success: boolean; message?: string }>(
      "/connect",
      "POST",
      undefined,
      30000
    );
  }

  async disconnect(
    clearSession: boolean
  ): Promise<{ success: boolean }> {
    return this.request<{ success: boolean }>(
      "/disconnect",
      "POST",
      { clearSession }
    );
  }

  async send(payload: SendPayload): Promise<{ success: boolean }> {
    return this.request<{ success: boolean }>("/send", "POST", payload);
  }

  private async request<T>(
    path: string,
    method: "GET" | "POST",
    body?: unknown,
    timeoutMs = 10000
  ): Promise<T> {
    let res: Response;
    try {
      res = await fetch(this.baseUrl + path, {
        method,
        headers: {
          "Content-Type": "application/json",
          ...(this.token ? { Authorization: `Bearer ${this.token}` } : {}),
        },
        body: body !== undefined ? JSON.stringify(body) : undefined,
        signal: AbortSignal.timeout(timeoutMs),
      });
    } catch (err) {
      throw new EngineClientError(
        `WhatsApp engine unreachable: ${err instanceof Error ? err.message : "unknown"}`
      );
    }

    if (!res.ok) {
      const text = await res.text().catch(() => res.statusText);
      throw new EngineClientError(text || res.statusText, res.status);
    }

    return (await res.json()) as T;
  }
}

let cached: WhatsAppEngineClient | null = null;

export function getEngineClient(): WhatsAppEngineClient {
  if (!cached) {
    cached = new WhatsAppEngineClient();
  }
  return cached;
}
